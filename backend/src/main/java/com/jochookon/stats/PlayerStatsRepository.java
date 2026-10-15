package com.jochookon.stats;

import java.sql.Date;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** Read projections only: no aggregate table to become stale after edits or deletion. */
@Repository
public class PlayerStatsRepository {
    private final NamedParameterJdbcTemplate jdbc;
    public PlayerStatsRepository(JdbcTemplate jdbc) { this.jdbc = new NamedParameterJdbcTemplate(jdbc); }

    private static final String SELECTED_MATCHES = """
            WITH selected_matches AS (
                SELECT id, recording_stage FROM match_records
                WHERE team_id = :teamId AND played_on BETWEEN :from AND :through
                  AND (:kind = 'ALL' OR match_kind = :kind)
                  AND (:scope = 'ALL' OR recording_stage = 'COMPLETED'
                       OR (:scope = 'RECORDED' AND recording_stage IS NULL))
            )
            """;

    record MatchCounts(long total, long completed, long legacy, long inProgress) { }

    MatchCounts counts(long teamId, PlayerStatsFilter filter) {
        return jdbc.queryForObject(SELECTED_MATCHES + """
                SELECT COUNT(*) AS total,
                    COALESCE(SUM(recording_stage = 'COMPLETED'), 0) AS completed,
                    COALESCE(SUM(recording_stage IS NULL), 0) AS legacy,
                    COALESCE(SUM(recording_stage IS NOT NULL AND recording_stage <> 'COMPLETED'), 0) AS in_progress
                FROM selected_matches
                """, parameters(teamId, filter), (r, n) -> new MatchCounts(r.getLong("total"),
                r.getLong("completed"), r.getLong("legacy"), r.getLong("in_progress")));
    }

    List<PlayerStatsResponse.Item> players(long teamId, PlayerStatsFilter filter) {
        // Separate aggregates prevent goals/assists multiplying when joining attendance and quarter rows.
        // A/B is part of the substitution key: two teams using the same slot both earn a full quarter.
        return jdbc.query(SELECTED_MATCHES + """
                , appearance_entries AS (
                    SELECT a.*, COUNT(*) OVER (PARTITION BY a.match_id, a.quarter_number, a.team, a.slot) AS slot_count
                    FROM match_appearances a
                    JOIN selected_matches m ON m.id = a.match_id
                    JOIN players p ON p.id = a.player_id AND p.team_id = :teamId
                ), appearance_totals AS (
                    SELECT player_id, SUM(goals) AS goals, SUM(assists) AS assists,
                        COUNT(DISTINCT match_id) AS appearances,
                        SUM(CASE WHEN slot_count = 2 THEN 0.5 ELSE 1 END) AS credited_quarters
                    FROM appearance_entries GROUP BY player_id
                ), attendance_totals AS (
                    SELECT a.player_id, COUNT(DISTINCT a.match_id) AS attendances
                    FROM match_participants a
                    JOIN selected_matches m ON m.id = a.match_id
                    JOIN players p ON p.id = a.player_id AND p.team_id = :teamId
                    WHERE a.attendance IN ('PRESENT', 'LATE') GROUP BY a.player_id
                )
                SELECT p.id, p.name, p.shirt_number, p.birth_year, p.player_type, p.active, p.first_choice,
                    COALESCE(a.goals, 0) AS goals, COALESCE(a.assists, 0) AS assists,
                    COALESCE(a.appearances, 0) AS appearances, COALESCE(t.attendances, 0) AS attendances,
                    COALESCE(a.credited_quarters, 0) AS credited_quarters
                FROM players p
                LEFT JOIN appearance_totals a ON a.player_id = p.id
                LEFT JOIN attendance_totals t ON t.player_id = p.id
                WHERE p.team_id = :teamId
                  AND ((p.player_type = 'MEMBER' AND p.active = 1)
                       OR ((:includeGuests = TRUE OR p.player_type = 'MEMBER')
                           AND (a.player_id IS NOT NULL OR t.player_id IS NOT NULL)))
                ORDER BY p.shirt_number IS NULL, p.shirt_number, p.name, p.id
                """, parameters(teamId, filter), (r, n) -> new PlayerStatsResponse.Item(
                r.getLong("id"), r.getString("name"), r.getObject("shirt_number", Integer.class),
                r.getObject("birth_year", Integer.class), r.getString("player_type"), r.getBoolean("active"),
                r.getString("first_choice"), r.getLong("goals"), r.getLong("assists"),
                r.getLong("appearances"), r.getLong("attendances"), r.getDouble("credited_quarters")));
    }

    List<Integer> availableYears(long teamId, java.time.LocalDate today) {
        var years = jdbc.queryForList("""
                SELECT DISTINCT YEAR(played_on) FROM match_records
                WHERE team_id = :teamId AND played_on <= :today
                """, new MapSqlParameterSource("teamId", teamId).addValue("today", Date.valueOf(today)), Integer.class);
        return Stream.concat(years.stream(), Stream.of(today.getYear())).distinct().sorted(Comparator.reverseOrder()).toList();
    }

    private MapSqlParameterSource parameters(long teamId, PlayerStatsFilter filter) {
        return new MapSqlParameterSource("teamId", teamId)
                .addValue("from", Date.valueOf(filter.from())).addValue("through", Date.valueOf(filter.through()))
                .addValue("kind", filter.kind().name()).addValue("scope", filter.recordScope().name())
                .addValue("includeGuests", filter.includeGuests());
    }
}
