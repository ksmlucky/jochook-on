package com.jochookon.stats;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** Read projections only: no aggregate table to become stale after edits or deletion. */
@Repository
public class PlayerStatsRepository {
    private final NamedParameterJdbcTemplate jdbc;
    private final EntityManager entityManager;
    public PlayerStatsRepository(JdbcTemplate jdbc, EntityManager entityManager) {
        this.jdbc = new NamedParameterJdbcTemplate(jdbc);
        this.entityManager = entityManager;
    }

    // Shared by totals, player details and year choices. Only the selected year is omitted for year choices.
    private static final String MATCH_FILTERS = """
                m.team_id = :teamId AND played_on <= :today
                  AND (:tournamentId IS NULL OR tournament_id = :tournamentId)
                  AND (:kind = 'ALL' OR match_kind = :kind)
                  AND (:scope = 'ALL' OR recording_stage = 'COMPLETED'
                       OR (:scope = 'RECORDED' AND recording_stage IS NULL))
                  AND (:competitionScope = 'ALL'
                       OR (:competitionScope = 'LEAGUE' AND tournament_id IS NULL)
                       OR (:competitionScope = 'TOURNAMENT' AND match_kind = 'EXTERNAL' AND tournament_id IS NOT NULL))
            """;

    private static final String SELECTED_MATCHES = """
            WITH selected_matches AS (
                SELECT m.id, played_on, kickoff, opponent, m.venue, match_kind, match_format, recording_stage, score_for, score_against,
                       tournament_id, tournament_stage, t.name AS tournament_name
                FROM match_records m LEFT JOIN tournaments t ON t.id = m.tournament_id AND t.team_id = m.team_id
                WHERE played_on BETWEEN :from AND :through AND
            """ + MATCH_FILTERS + ")\n";

    // Calculate substitutions across ALL eligible players before selecting one player's details.
    // A/B remains part of the slot key; a player switching sides still contributes one row per match.
    // Both season totals and paged match details use this same contribution set.
    private static final String CONTRIBUTIONS = SELECTED_MATCHES + """
            , appearance_entries AS (
                SELECT a.*, COUNT(*) OVER (PARTITION BY a.match_id, a.quarter_number, a.team, a.slot) AS slot_count
                FROM match_appearances a
                JOIN selected_matches m ON m.id = a.match_id
                JOIN players p ON p.id = a.player_id AND p.team_id = :teamId
            ), appearance_matches AS (
                SELECT player_id, match_id, SUM(goals) AS goals, SUM(assists) AS assists,
                    SUM(free_kick_goals) AS free_kick_goals, SUM(penalty_goals) AS penalty_goals,
                    SUM(CASE WHEN slot_count = 2 THEN 0.5 ELSE 1 END) AS credited_quarters
                FROM appearance_entries GROUP BY player_id, match_id
            ), attendance_entries AS (
                SELECT a.player_id, a.match_id, a.attendance
                FROM match_participants a
                JOIN selected_matches m ON m.id = a.match_id
                JOIN players p ON p.id = a.player_id AND p.team_id = :teamId
            ), contribution_keys AS (
                SELECT player_id, match_id FROM appearance_matches
                UNION
                SELECT player_id, match_id FROM attendance_entries WHERE attendance IN ('PRESENT', 'LATE')
            ), player_match_contributions AS (
                SELECT k.player_id, k.match_id, COALESCE(a.goals, 0) AS goals, COALESCE(a.assists, 0) AS assists,
                    COALESCE(a.free_kick_goals, 0) AS free_kick_goals, COALESCE(a.penalty_goals, 0) AS penalty_goals,
                    COALESCE(a.credited_quarters, 0) AS credited_quarters,
                    (a.player_id IS NOT NULL) AS appeared, t.attendance
                FROM contribution_keys k
                LEFT JOIN appearance_matches a ON a.player_id = k.player_id AND a.match_id = k.match_id
                LEFT JOIN attendance_entries t ON t.player_id = k.player_id AND t.match_id = k.match_id
            )
            """;

    private static final String PLAYER_SUMMARIES = CONTRIBUTIONS + """
            , player_totals AS (
                SELECT player_id, SUM(goals) AS goals, SUM(assists) AS assists, SUM(appeared) AS appearances,
                    SUM(free_kick_goals) AS free_kick_goals, SUM(penalty_goals) AS penalty_goals,
                    SUM(CASE WHEN attendance IN ('PRESENT', 'LATE') THEN 1 ELSE 0 END) AS attendances,
                    SUM(credited_quarters) AS credited_quarters
                FROM player_match_contributions GROUP BY player_id
            )
            SELECT p.id, p.name, p.shirt_number, p.birth_year, p.player_type, p.active, p.first_choice,
                COALESCE(t.goals, 0) AS goals, COALESCE(t.assists, 0) AS assists,
                COALESCE(t.free_kick_goals, 0) AS free_kick_goals, COALESCE(t.penalty_goals, 0) AS penalty_goals,
                COALESCE(t.appearances, 0) AS appearances, COALESCE(t.attendances, 0) AS attendances,
                COALESCE(t.credited_quarters, 0) AS credited_quarters
            FROM players p
            LEFT JOIN player_totals t ON t.player_id = p.id
            WHERE p.team_id = :teamId
              AND ((p.player_type = 'MEMBER' AND p.active = 1)
                   OR ((:includeGuests = TRUE OR p.player_type = 'MEMBER') AND t.player_id IS NOT NULL))
            """;

    record MatchCounts(long total, long completed, long legacy, long inProgress, Long goalsAgainst,
                       long scoredExternalMatchCount, long missingExternalScoreCount, long excludedInternalMatchCount) {
        MatchCounts(long total, long completed, long legacy, long inProgress) {
            this(total, completed, legacy, inProgress, null, 0, 0, 0);
        }
        long externalMatchCount() { return scoredExternalMatchCount + missingExternalScoreCount; }
        long internalMatchCount() { return excludedInternalMatchCount; }
    }

    MatchCounts counts(long teamId, PlayerStatsFilter filter) {
        return jdbc.queryForObject(SELECTED_MATCHES + """
                SELECT COUNT(*) AS total,
                    COALESCE(SUM(recording_stage = 'COMPLETED'), 0) AS completed,
                    COALESCE(SUM(recording_stage IS NULL), 0) AS legacy,
                    COALESCE(SUM(recording_stage IS NOT NULL AND recording_stage <> 'COMPLETED'), 0) AS in_progress,
                    SUM(CASE WHEN match_kind = 'EXTERNAL' THEN score_against END) AS goals_against,
                    COALESCE(SUM(match_kind = 'EXTERNAL' AND score_against IS NOT NULL), 0) AS scored_external,
                    COALESCE(SUM(match_kind = 'EXTERNAL' AND score_against IS NULL), 0) AS missing_external,
                    COALESCE(SUM(match_kind = 'INTERNAL'), 0) AS excluded_internal
                FROM selected_matches
                """, parameters(teamId, filter), (r, n) -> new MatchCounts(r.getLong("total"),
                r.getLong("completed"), r.getLong("legacy"), r.getLong("in_progress"), r.getObject("goals_against", Long.class),
                r.getLong("scored_external"), r.getLong("missing_external"), r.getLong("excluded_internal")));
    }

    List<PlayerStatsResponse.Item> players(long teamId, PlayerStatsFilter filter) {
        return jdbc.query(PLAYER_SUMMARIES + "ORDER BY p.shirt_number IS NULL, p.shirt_number, p.name, p.id",
                parameters(teamId, filter), PlayerStatsRepository::mapPlayer);
    }

    Optional<PlayerStatsResponse.Item> player(long teamId, PlayerStatsFilter filter, long playerId) {
        return jdbc.query(PLAYER_SUMMARIES + "AND p.id = :playerId",
                parameters(teamId, filter).addValue("playerId", playerId), PlayerStatsRepository::mapPlayer).stream().findFirst();
    }

    long contributingMatchCount(long teamId, PlayerStatsFilter filter, long playerId) {
        return jdbc.queryForObject(CONTRIBUTIONS + "SELECT COUNT(*) FROM player_match_contributions WHERE player_id = :playerId",
                parameters(teamId, filter).addValue("playerId", playerId), Long.class);
    }

    List<PlayerMatchStatsResponse.Item> contributingMatches(long teamId, PlayerStatsFilter filter, long playerId,
                                                           int size, long offset) {
        var rows = jdbc.query(CONTRIBUTIONS + """
                SELECT m.id, m.played_on, m.opponent, m.venue, m.match_kind, m.recording_stage,
                    m.score_for, m.score_against, c.goals, c.assists, c.credited_quarters, c.appeared, c.attendance,
                    m.tournament_id, m.tournament_name, m.tournament_stage, c.free_kick_goals, c.penalty_goals, m.match_format
                FROM player_match_contributions c
                JOIN selected_matches m ON m.id = c.match_id
                WHERE c.player_id = :playerId
                ORDER BY m.played_on DESC, m.id DESC
                LIMIT :size OFFSET :offset
                """, parameters(teamId, filter).addValue("playerId", playerId).addValue("size", size).addValue("offset", offset),
                (r, n) -> new PlayerMatchStatsResponse.Item(r.getLong("id"), r.getDate("played_on").toLocalDate(),
                        null, r.getString("opponent"), r.getString("venue"),
                        r.getString("match_kind"), r.getString("recording_stage"), r.getObject("score_for", Integer.class),
                        r.getObject("score_against", Integer.class), r.getLong("goals"), r.getLong("assists"),
                        r.getDouble("credited_quarters"), r.getBoolean("appeared"), r.getString("attendance"),
                        r.getObject("tournament_id", Long.class), r.getString("tournament_name"), r.getString("tournament_stage"),
                        r.getLong("free_kick_goals"), r.getLong("penalty_goals"), com.jochookon.match.MatchFormat.valueOf(r.getString("match_format"))));
        if (rows.isEmpty()) return rows;

        // MatchRecord uses Hibernate's LocalTime mapping and configured JDBC time zone. Reading raw
        // TIME via getObject(LocalTime.class) bypasses that mapping and can shift the displayed hour.
        // Reuse the entity mapping in one scalar query, without loading match collections or changing data.
        var kickoff = new HashMap<Long, LocalTime>();
        entityManager.createQuery("""
                select m.id as id, m.kickoff as kickoff from MatchRecord m
                where m.teamId = :teamId and m.id in :ids
                """, Tuple.class).setParameter("teamId", teamId)
                .setParameter("ids", rows.stream().map(PlayerMatchStatsResponse.Item::matchId).toList())
                .getResultList().forEach(row -> kickoff.put(row.get("id", Long.class), row.get("kickoff", LocalTime.class)));
        // Keep the database's date/id page order; only the page's kickoff values use the ORM mapping.
        return rows.stream().map(row -> row.withKickoff(kickoff.get(row.matchId()))).toList();
    }

    private static PlayerStatsResponse.Item mapPlayer(ResultSet r, int rowNumber) throws SQLException {
        return new PlayerStatsResponse.Item(
                r.getLong("id"), r.getString("name"), r.getObject("shirt_number", Integer.class),
                r.getObject("birth_year", Integer.class), r.getString("player_type"), r.getBoolean("active"),
                r.getString("first_choice"), r.getLong("goals"), r.getLong("assists"),
                r.getLong("appearances"), r.getLong("attendances"), r.getDouble("credited_quarters"),
                r.getLong("free_kick_goals"), r.getLong("penalty_goals"));
    }

    List<Integer> availableYears(long teamId, java.time.LocalDate today) {
        return availableYears(teamId, today, null);
    }
    List<Integer> availableYears(long teamId, java.time.LocalDate today, Long tournamentId) {
        return availableYears(teamId, PlayerStatsFilter.of(null, StatsMatchKind.ALL, StatsRecordScope.ALL, false, today, tournamentId));
    }
    List<Integer> availableYears(long teamId, PlayerStatsFilter filter) {
        var years = jdbc.queryForList("""
                SELECT DISTINCT YEAR(played_on) FROM match_records m WHERE
                """ + MATCH_FILTERS, parameters(teamId, filter), Integer.class);
        return Stream.concat(years.stream(), Stream.of(filter.today().getYear())).distinct().sorted(Comparator.reverseOrder()).toList();
    }

    private MapSqlParameterSource parameters(long teamId, PlayerStatsFilter filter) {
        return new MapSqlParameterSource("teamId", teamId)
                .addValue("from", Date.valueOf(filter.from())).addValue("through", Date.valueOf(filter.through()))
                .addValue("kind", filter.kind().name()).addValue("scope", filter.recordScope().name())
                .addValue("includeGuests", filter.includeGuests()).addValue("tournamentId", filter.tournamentId())
                .addValue("today", Date.valueOf(filter.today())).addValue("competitionScope", filter.competitionScope().name());
    }
}
