package com.jochookon.tournament;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.jochookon.match.*;
import com.jochookon.stats.*;
import com.jochookon.team.*;
import java.time.*;
import java.util.*;
import java.util.function.Supplier;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.mysql.MySQLContainer;
import tools.jackson.databind.ObjectMapper;

@Tag("integration") @Testcontainers
@SpringBootTest(properties = {"spring.datasource.password=unused-test-password", "jochookon.bootstrap.admin.username=",
        "jochookon.bootstrap.admin.password=", "jochookon.bootstrap.service-admin-username="})
@AutoConfigureMockMvc
class TournamentIntegrationTest {
    @Container @ServiceConnection static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Autowired JdbcTemplate jdbc;
    @Autowired TournamentService tournaments;
    @Autowired MatchService matches;
    @Autowired MatchSaveService saves;
    @Autowired PlayerStatsService stats;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    final LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
    @BeforeEach void seed() {
        TeamTestData.seed(jdbc);
        jdbc.update("INSERT INTO teams(id,name,status) VALUES (2,'가상 다른 팀','ACTIVE') ON DUPLICATE KEY UPDATE status='ACTIVE'");
        for (String table : List.of("match_save_requests", "match_record_events", "match_planned_lineups", "match_appearances",
                "match_quarters", "match_participants", "match_records", "tournaments", "players")) jdbc.update("DELETE FROM " + table);
    }
    @AfterEach void clear() { TeamContext.clear(); SecurityContextHolder.clearContext(); }
    private <T> T scoped(long team, Supplier<T> work) {
        TeamContext.set(team);
        SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated("test-admin", null,
                AuthorityUtils.createAuthorityList("ROLE_DIRECTOR")));
        try { return work.get(); } finally { clear(); }
    }
    private <T> T scoped(Supplier<T> work) { return scoped(1, work); }
    private TournamentRequest tournamentInput(String name, Long version) {
        return new TournamentRequest(name, today.minusDays(2), today.minusDays(1), "가상 구장", "30대부", "가상 메모", version);
    }
    private TournamentResponse tournament() { return scoped(() -> tournaments.create(tournamentInput("가상 대회", null))); }
    private MatchRequest input(Long version, Long tournament, TournamentStage stage, Boolean specified, MatchKind kind) {
        return new MatchRequest(today, LocalTime.of(11, 0), "가상 구장", kind == MatchKind.INTERNAL ? "" : "가상 상대", "", version,
                List.of(), List.of(new MatchRequest.Quarter(1, List.of()), new MatchRequest.Quarter(2, List.of()),
                new MatchRequest.Quarter(3, List.of()), new MatchRequest.Quarter(4, List.of())), List.of(), null, null,
                kind, RecordingStage.COMPLETED, Formation.F4123, Formation.F4123, tournament, stage, specified);
    }
    @Test void competitionMatchListFiltersBeforePagingAndIncludesInternalInLeague() throws Exception {
        var t = tournament();
        var otherTournament = scoped(() -> tournaments.create(tournamentInput("다른 가상 대회", null)));
        var league = new ArrayList<Long>(); var tournament = new ArrayList<Long>();
        for (int i = 0; i < 13; i++) {
            league.add(competitionGame(1, today, "EXTERNAL", "COMPLETED", null));
            tournament.add(competitionGame(1, today, "EXTERNAL", "COMPLETED", i % 2 == 0 ? t.id() : otherTournament.id()));
            league.add(competitionGame(1, today, "INTERNAL", "COMPLETED", null));
        }
        competitionGame(2, today, "EXTERNAL", "COMPLETED", null);
        Collections.reverse(league); Collections.reverse(tournament);
        for (var scope : List.of(CompetitionScope.LEAGUE, CompetitionScope.TOURNAMENT)) {
            var expected = scope == CompetitionScope.LEAGUE ? league : tournament;
            var actual = new ArrayList<Long>();
            int totalPages = (expected.size() + 9) / 10;
            for (int page = 0; page <= totalPages; page++) {
                String body = mvc.perform(get("/api/v1/matches").param("competitionScope", scope.name()).param("page", String.valueOf(page))
                                .header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                        .andExpect(status().isOk()).andExpect(jsonPath("$.competitionScope").value(scope.name()))
                        .andExpect(jsonPath("$.totalElements").value(expected.size())).andExpect(jsonPath("$.totalPages").value(totalPages))
                        .andReturn().getResponse().getContentAsString();
                for (var row : json.readTree(body).get("items")) actual.add(row.get("id").asLong());
            }
            assertThat(actual).containsExactlyElementsOf(expected).doesNotHaveDuplicates();
        }
        assertThat(scoped(() -> matches.list(0, 100)).totalElements()).isEqualTo(39);
        for (var scope : List.of(CompetitionScope.ALL, CompetitionScope.TOURNAMENT)) {
            var page = scoped(() -> matches.list(0, 10, t.id(), scope));
            assertThat(page.totalElements()).isEqualTo(7);
            assertThat(page.items()).allSatisfy(row -> assertThat(row.tournamentId()).isEqualTo(t.id()));
        }
    }
    @Test void externalSeasonTotalEqualsLeaguePlusTournamentAndEveryDetailSharesTheFilter() throws Exception {
        var t = tournament();
        jdbc.update("INSERT INTO players(id,team_id,name,shirt_number,position,first_choice,active,player_type) VALUES (8101,1,'범위 가상 선수',7,'MF','CM',1,'MEMBER'),(8102,1,'범위 가상 용병',NULL,'MF','CM',1,'GUEST')");
        long league = competitionGame(1, today, "EXTERNAL", "COMPLETED", null);
        long cup = competitionGame(1, today, "EXTERNAL", "COMPLETED", t.id());
        long attendedOnly = competitionGame(1, today, "EXTERNAL", "COMPLETED", null);
        for (long game : new long[]{league, cup, attendedOnly}) competitionAttendance(game, 8101);
        competitionAppearance(league, 8101, 0, 2, 1); competitionAppearance(league, 8102, 1, 1, 0);
        competitionAppearance(cup, 8101, 0, 5, 2);
        for (long ignored : new long[]{competitionGame(1, today, "INTERNAL", "COMPLETED", null),
                competitionGame(1, today.plusDays(1), "EXTERNAL", "COMPLETED", t.id()),
                competitionGame(2, today, "EXTERNAL", "COMPLETED", null),
                competitionGame(1, today, "EXTERNAL", "ACTUAL", t.id())}) {
            competitionAttendance(ignored, 8101); competitionAppearance(ignored, 8101, 0, 90, 0);
        }
        var results = new EnumMap<CompetitionScope, PlayerStatsResponse>(CompetitionScope.class);
        for (var scope : CompetitionScope.values()) {
            var season = scoped(() -> stats.list(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, null, scope));
            results.put(scope, season);
            var detail = scoped(() -> stats.matches(8101, today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0, null, scope));
            assertThat(season.competitionScope()).isEqualTo(scope); assertThat(detail.competitionScope()).isEqualTo(scope);
            assertThat(detail.player()).isEqualTo(season.items().getFirst());
            assertThat(detail.items().stream().mapToLong(PlayerMatchStatsResponse.Item::goals).sum()).isEqualTo(detail.player().goals());
            assertThat(detail.items().stream().mapToDouble(PlayerMatchStatsResponse.Item::creditedQuarters).sum()).isEqualTo(detail.player().creditedQuarters());
            assertThat(detail.items()).allSatisfy(row -> {
                if (scope == CompetitionScope.LEAGUE) assertThat(row.tournamentId()).isNull();
                if (scope == CompetitionScope.TOURNAMENT) assertThat(row.tournamentId()).isEqualTo(t.id());
            });
            mvc.perform(get("/api/v1/stats/players/8101/matches").param("competitionScope", scope.name())
                            .header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.competitionScope").value(scope.name()));
        }
        var all = results.get(CompetitionScope.ALL); var l = results.get(CompetitionScope.LEAGUE); var c = results.get(CompetitionScope.TOURNAMENT);
        assertThat(all.matchCount()).isEqualTo(l.matchCount() + c.matchCount()).isEqualTo(3);
        var a = all.items().getFirst(); var b = l.items().getFirst(); var d = c.items().getFirst();
        assertThat(a.goals()).isEqualTo(b.goals() + d.goals()).isEqualTo(7);
        assertThat(a.assists()).isEqualTo(b.assists() + d.assists()).isEqualTo(3);
        assertThat(a.appearances()).isEqualTo(b.appearances() + d.appearances()).isEqualTo(2);
        assertThat(a.attendances()).isEqualTo(b.attendances() + d.attendances()).isEqualTo(3);
        assertThat(a.creditedQuarters()).isEqualTo(b.creditedQuarters() + d.creditedQuarters()).isEqualTo(1.5);
        assertThat(b.creditedQuarters()).isEqualTo(0.5);
        var allKindsLeague = scoped(() -> stats.list(today.getYear(), StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.LEAGUE));
        assertThat(allKindsLeague.items().getFirst().goals()).isEqualTo(l.items().getFirst().goals() + 90);
        assertThat(allKindsLeague.matchCount()).isEqualTo(l.matchCount() + 1);
        var guests = scoped(() -> stats.list(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, true, null, CompetitionScope.LEAGUE));
        assertThat(guests.items()).filteredOn(p -> p.playerId() == 8102).singleElement().satisfies(p -> assertThat(p.creditedQuarters()).isEqualTo(0.5));
        for (var scope : List.of(CompetitionScope.ALL, CompetitionScope.TOURNAMENT)) {
            var specific = scoped(() -> stats.list(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, t.id(), scope));
            assertThat(specific.items()).isEqualTo(c.items());
            assertThat(scoped(() -> stats.matches(8101, today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0, t.id(), scope)).items())
                    .singleElement().satisfies(row -> assertThat(row.matchId()).isEqualTo(cup));
        }
    }
    @Test void availableYearsRespectsKindRecordingScopeCompetitionAndTeamButNotSelectedYear() {
        int y = today.getYear(); var t = tournament();
        competitionGame(1, LocalDate.of(y - 6, 1, 1), "EXTERNAL", "COMPLETED", null);
        competitionGame(1, LocalDate.of(y - 5, 1, 1), "EXTERNAL", "COMPLETED", t.id());
        competitionGame(1, LocalDate.of(y - 4, 1, 1), "INTERNAL", "COMPLETED", null);
        competitionGame(1, LocalDate.of(y - 3, 1, 1), "EXTERNAL", "ACTUAL", null);
        competitionGame(1, LocalDate.of(y - 2, 1, 1), "EXTERNAL", null, t.id());
        competitionGame(2, LocalDate.of(y - 1, 1, 1), "EXTERNAL", "COMPLETED", null);
        competitionGame(1, LocalDate.of(y + 1, 1, 1), "EXTERNAL", "COMPLETED", null);
        assertThat(scoped(() -> stats.list(y - 6, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL)).availableYears()).containsExactly(y, y - 5, y - 6);
        assertThat(scoped(() -> stats.list(y, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.LEAGUE)).availableYears()).containsExactly(y, y - 4, y - 6);
        assertThat(scoped(() -> stats.list(y, StatsMatchKind.EXTERNAL, StatsRecordScope.ALL, false, null, CompetitionScope.LEAGUE)).availableYears()).containsExactly(y, y - 3, y - 6);
        assertThat(scoped(() -> stats.list(y, StatsMatchKind.EXTERNAL, StatsRecordScope.RECORDED, false, t.id(), CompetitionScope.TOURNAMENT)).availableYears()).containsExactly(y, y - 2, y - 5);
        assertThat(scoped(() -> stats.list(y, StatsMatchKind.INTERNAL, StatsRecordScope.COMPLETED, false)).availableYears()).containsExactly(y, y - 4);
        assertThat(scoped(() -> stats.list(y, StatsMatchKind.INTERNAL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.LEAGUE)).availableYears()).containsExactly(y, y - 4);
    }
    @Test void leagueIncludesInternalInSeasonAndDetailsWhileExplicitKindStillRestrictsAndYearChangesApply() throws Exception {
        int y = today.getYear(); var t = tournament();
        jdbc.update("INSERT INTO players(id,team_id,name,shirt_number,position,first_choice,active,player_type) VALUES (8301,1,'자체전 합계 가상 선수',7,'MF','CM',1,'MEMBER'),(8302,1,'자체전 합계 가상 용병',NULL,'MF','CM',1,'GUEST')");
        long external = competitionGame(1, today, "EXTERNAL", "COMPLETED", null);
        long internal = competitionGame(1, today, "INTERNAL", "COMPLETED", null);
        long cup = competitionGame(1, today, "EXTERNAL", "COMPLETED", t.id());
        long previous = competitionGame(1, LocalDate.of(y - 1, 12, 31), "INTERNAL", "COMPLETED", null);
        for (long game : new long[]{external, internal, cup, previous}) competitionAttendance(game, 8301);
        competitionAppearance(external, 8301, 0, 2, 1); competitionAppearance(external, 8302, 1, 0, 0);
        competitionAppearance(internal, 8301, 0, 3, 2); competitionAppearance(cup, 8301, 0, 5, 3);
        competitionAppearance(previous, 8301, 0, 9, 4);
        // An opponent in the same slot is not a substitution; A/B stays part of the credit key.
        jdbc.update("INSERT INTO match_appearances(match_id,quarter_number,team,slot,entry_order,player_id,goals,assists) VALUES (?,1,'B','ST',0,8302,0,0)", internal);
        jdbc.update("UPDATE match_appearances SET free_kick_goals=1 WHERE match_id=? AND player_id=8301", external);
        jdbc.update("UPDATE match_appearances SET free_kick_goals=1,penalty_goals=1 WHERE match_id=? AND player_id=8301", internal);
        jdbc.update("UPDATE match_appearances SET free_kick_goals=2,penalty_goals=2 WHERE match_id=? AND player_id=8301", cup);
        var totals = new EnumMap<CompetitionScope, PlayerStatsResponse.Item>(CompetitionScope.class);
        for (var kind : StatsMatchKind.values()) for (var scope : CompetitionScope.values()) {
            if (kind == StatsMatchKind.INTERNAL && scope == CompetitionScope.TOURNAMENT) continue;
            var season = scoped(() -> stats.list(y, kind, StatsRecordScope.COMPLETED, false, null, scope));
            var detail = scoped(() -> stats.matches(8301, y, kind, StatsRecordScope.COMPLETED, false, 0, null, scope));
            assertThat(detail.player()).isEqualTo(season.items().getFirst());
            assertThat(detail.totalElements()).isEqualTo(season.matchCount());
            assertThat(detail.items().stream().mapToLong(PlayerMatchStatsResponse.Item::goals).sum()).isEqualTo(detail.player().goals());
            assertThat(detail.items().stream().mapToLong(PlayerMatchStatsResponse.Item::freeKickGoals).sum()).isEqualTo(detail.player().freeKickGoals());
            assertThat(detail.items().stream().mapToLong(PlayerMatchStatsResponse.Item::penaltyGoals).sum()).isEqualTo(detail.player().penaltyGoals());
            assertThat(detail.items().stream().mapToDouble(PlayerMatchStatsResponse.Item::creditedQuarters).sum()).isEqualTo(detail.player().creditedQuarters());
            if (kind != StatsMatchKind.ALL) assertThat(detail.items()).allSatisfy(row -> assertThat(row.kind()).isEqualTo(kind.name()));
            if (scope == CompetitionScope.LEAGUE) assertThat(detail.items()).allSatisfy(row -> assertThat(row.tournamentId()).isNull());
            if (kind == StatsMatchKind.ALL) totals.put(scope, detail.player());
            if (kind == StatsMatchKind.INTERNAL) {
                assertThat(detail.totalElements()).isEqualTo(1);
                assertThat(detail.player().goals()).isEqualTo(3);
                assertThat(detail.player().creditedQuarters()).isEqualTo(1);
            }
            if (kind == StatsMatchKind.EXTERNAL && scope == CompetitionScope.LEAGUE) {
                assertThat(detail.totalElements()).isEqualTo(1);
                assertThat(detail.player().goals()).isEqualTo(2);
                assertThat(detail.player().creditedQuarters()).isEqualTo(0.5);
            }
        }
        var all = totals.get(CompetitionScope.ALL); var league = totals.get(CompetitionScope.LEAGUE); var tournament = totals.get(CompetitionScope.TOURNAMENT);
        assertThat(all.goals()).isEqualTo(league.goals() + tournament.goals()).isEqualTo(10);
        assertThat(all.assists()).isEqualTo(league.assists() + tournament.assists()).isEqualTo(6);
        assertThat(all.freeKickGoals()).isEqualTo(league.freeKickGoals() + tournament.freeKickGoals()).isEqualTo(4);
        assertThat(all.penaltyGoals()).isEqualTo(league.penaltyGoals() + tournament.penaltyGoals()).isEqualTo(3);
        assertThat(all.creditedQuarters()).isEqualTo(league.creditedQuarters() + tournament.creditedQuarters()).isEqualTo(2.5);
        assertThat(league.goals()).isEqualTo(5); assertThat(league.creditedQuarters()).isEqualTo(1.5);
        var oldSeason = scoped(() -> stats.list(y - 1, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.LEAGUE));
        var oldDetail = scoped(() -> stats.matches(8301, y - 1, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, 0, null, CompetitionScope.LEAGUE));
        assertThat(oldDetail.player()).isEqualTo(oldSeason.items().getFirst());
        assertThat(oldDetail.items()).singleElement().satisfies(row -> assertThat(row.matchId()).isEqualTo(previous));
        assertThat(oldDetail.player().goals()).isEqualTo(9);
        assertThat(oldSeason.availableYears()).containsExactly(y, y - 1);
        mvc.perform(get("/api/v1/stats/players/8301/matches").param("kind", "ALL").param("competitionScope", "LEAGUE").param("year", String.valueOf(y))
                        .header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.player.goals").value(5)).andExpect(jsonPath("$.player.freeKickGoals").value(2));
    }
    @Test void changingTournamentLinkImmediatelyMovesCountsAndContributionsBetweenScopes() {
        var t = tournament();
        jdbc.update("INSERT INTO players(id,team_id,name,shirt_number,position,first_choice,active,player_type) VALUES (8201,1,'이동 검증 선수',7,'MF','CM',1,'MEMBER')");
        long game = competitionGame(1, today, "EXTERNAL", "COMPLETED", null);
        competitionAttendance(game, 8201); competitionAppearance(game, 8201, 0, 2, 0);
        assertThat(scoped(() -> stats.matches(8201, today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0, null, CompetitionScope.LEAGUE)).totalElements()).isEqualTo(1);
        jdbc.update("UPDATE match_records SET tournament_id=? WHERE id=?", t.id(), game);
        assertThat(scoped(() -> matches.list(0, 10, null, CompetitionScope.LEAGUE)).totalElements()).isZero();
        assertThat(scoped(() -> matches.list(0, 10, null, CompetitionScope.TOURNAMENT)).totalElements()).isEqualTo(1);
        assertThat(scoped(() -> stats.matches(8201, today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0, null, CompetitionScope.LEAGUE)).player().goals()).isZero();
        assertThat(scoped(() -> stats.matches(8201, today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0, t.id(), CompetitionScope.TOURNAMENT)).player().goals()).isEqualTo(2);
        jdbc.update("DELETE FROM match_appearances WHERE match_id=?", game); jdbc.update("DELETE FROM match_participants WHERE match_id=?", game);
        jdbc.update("DELETE FROM match_records WHERE id=?", game);
        assertThat(scoped(() -> stats.matches(8201, today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0, null, CompetitionScope.TOURNAMENT)).totalElements()).isZero();
        assertThat(scoped(() -> matches.list(0, 10, null, CompetitionScope.TOURNAMENT)).totalElements()).isZero();
    }
    private long competitionGame(long team, LocalDate date, String kind, String stage, Long tournament) {
        jdbc.update("INSERT INTO match_records(team_id,played_on,kickoff,venue,opponent,notes,match_kind,recording_stage,tournament_id) VALUES (?,?,'11:00:00','','','가상 범위 검증',?,?,?)",
                team, java.sql.Date.valueOf(date), kind, stage, tournament);
        return jdbc.queryForObject("SELECT MAX(id) FROM match_records", Long.class);
    }
    private void competitionAttendance(long game, long player) {
        jdbc.update("INSERT INTO match_participants(match_id,player_id,vote,attendance) VALUES (?,?,'ATTENDING','PRESENT')", game, player);
    }
    private void competitionAppearance(long game, long player, int order, int goals, int assists) {
        jdbc.update("INSERT INTO match_appearances(match_id,quarter_number,team,slot,entry_order,player_id,goals,assists) VALUES (?,1,'A','ST',?,?,?,?)", game, order, player, goals, assists);
    }
    @Test void crudPaginationVersionAndTeamIsolation() throws Exception {
        var created = tournament();
        assertThat(created.version()).isZero(); assertThat(created.matchCount()).isZero();
        for (int i = 0; i < 11; i++) { int n = i; scoped(() -> tournaments.create(tournamentInput("가상 " + n, null))); }
        var page = scoped(() -> tournaments.list(1, 10));
        assertThat(page.totalElements()).isEqualTo(12); assertThat(page.totalPages()).isEqualTo(2); assertThat(page.items()).hasSize(2);
        assertThat(scoped(2, () -> tournaments.list(0, 10)).items()).isEmpty();
        assertThatThrownBy(() -> scoped(2, () -> tournaments.get(created.id()))).isInstanceOf(TournamentNotFoundException.class);
        var edited = scoped(() -> tournaments.update(created.id(), tournamentInput("수정 대회", 0L)));
        assertThat(edited.version()).isEqualTo(1);
        assertThatThrownBy(() -> scoped(() -> tournaments.update(created.id(), tournamentInput("충돌", 0L))))
                .isInstanceOf(org.springframework.dao.OptimisticLockingFailureException.class);
        mvc.perform(get("/api/v1/tournaments/" + created.id()).header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("수정 대회"));
    }
    @Test void filteredMatchListHttpUsesAssociationPathAndCorrectPageCount() throws Exception {
        var selected = tournament();
        var other = scoped(() -> tournaments.create(tournamentInput("다른 가상 대회", null)));
        var first = scoped(() -> matches.create(input(null, selected.id(), TournamentStage.GROUP, true, MatchKind.EXTERNAL)));
        var second = scoped(() -> matches.create(input(null, selected.id(), TournamentStage.FINAL, true, MatchKind.EXTERNAL)));
        scoped(() -> matches.create(input(null, other.id(), null, true, MatchKind.EXTERNAL)));
        scoped(() -> matches.create(input(null, null, null, true, MatchKind.EXTERNAL)));
        for (int page = 0; page < 2; page++) {
            long expectedId = page == 0 ? second.id() : first.id();
            mvc.perform(get("/api/v1/matches").param("tournamentId", selected.id().toString())
                            .param("page", String.valueOf(page)).param("size", "1")
                            .header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.page").value(page))
                    .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.totalPages").value(2))
                    .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].id").value(expectedId))
                    .andExpect(jsonPath("$.items[0].tournamentId").value(selected.id()))
                    .andExpect(jsonPath("$.items[0].tournamentName").value(selected.name()));
        }
        mvc.perform(get("/api/v1/matches").param("tournamentId", selected.id().toString())
                        .param("page", "2").param("size", "1").header("X-Team-Id", 1)
                        .with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.items").isEmpty());
    }
    @Test void linksOutsideDatesWithOptionalStageAndRenameKeepsMatchVersionAndHistoricalName() {
        var t = tournament();
        var created = scoped(() -> matches.create(input(null, t.id(), null, true, MatchKind.EXTERNAL)));
        assertThat(created.tournamentId()).isEqualTo(t.id()); assertThat(created.tournamentStage()).isNull();
        assertThat(created.playedOn()).isAfter(t.endDate());
        var updated = scoped(() -> tournaments.update(t.id(), tournamentInput("새 대회명", t.version())));
        var current = scoped(() -> matches.get(created.id()));
        assertThat(current.tournamentName()).isEqualTo(updated.name()); assertThat(current.version()).isEqualTo(created.version());
        assertThat(scoped(() -> matches.list(0, 10, t.id())).items()).singleElement().satisfies(m -> assertThat(m.tournamentName()).isEqualTo("새 대회명"));
        assertThat(scoped(() -> tournaments.get(t.id())).matchCount()).isEqualTo(1);
        String snapshot = jdbc.queryForObject("SELECT after_snapshot FROM match_record_events WHERE match_id=?", String.class, created.id());
        assertThat(json.readTree(snapshot).get("tournamentName").asString()).isEqualTo("가상 대회");
        scoped(() -> { matches.delete(created.id(), created.version()); return null; });
        assertThat(scoped(() -> tournaments.get(t.id())).matchCount()).isZero();
    }
    @Test void omittedOldFieldsPreserveAndExplicitSelectionUnlinksOrChangesStage() {
        var t = tournament();
        var created = scoped(() -> matches.create(input(null, t.id(), TournamentStage.GROUP, null, MatchKind.EXTERNAL)));
        var omitted = scoped(() -> matches.update(created.id(), input(created.version(), null, null, null, MatchKind.EXTERNAL)));
        assertThat(omitted.tournamentId()).isEqualTo(t.id()); assertThat(omitted.tournamentStage()).isEqualTo(TournamentStage.GROUP);
        var finalMatch = scoped(() -> matches.update(created.id(), input(omitted.version(), t.id(), TournamentStage.FINAL, true, MatchKind.EXTERNAL)));
        assertThat(finalMatch.tournamentStage()).isEqualTo(TournamentStage.FINAL);
        var unlinked = scoped(() -> matches.update(created.id(), input(finalMatch.version(), null, null, true, MatchKind.EXTERNAL)));
        assertThat(unlinked.tournamentId()).isNull(); assertThat(unlinked.tournamentName()).isNull(); assertThat(unlinked.tournamentStage()).isNull();
        assertThat(scoped(() -> matches.list(0, 10, t.id())).totalElements()).isZero();
    }
    @Test void rejectsInternalStageWithoutTournamentAndCrossTeamLinksWithNoPartialHistory() throws Exception {
        var t = tournament();
        var other = scoped(2, () -> tournaments.create(tournamentInput("다른 팀 대회", null)));
        assertThatThrownBy(() -> scoped(() -> matches.create(input(null, t.id(), null, true, MatchKind.INTERNAL)))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> scoped(() -> matches.create(input(null, null, TournamentStage.FINAL, true, MatchKind.EXTERNAL)))).isInstanceOf(IllegalArgumentException.class);
        for (long id : new long[]{other.id(), Long.MAX_VALUE}) {
            mvc.perform(post("/api/v1/matches").header("X-Team-Id", 1).with(user("test-admin").roles("DIRECTOR")).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input(null, id, null, true, MatchKind.EXTERNAL))))
                    .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("TOURNAMENT_NOT_FOUND"));
            mvc.perform(get("/api/v1/matches?tournamentId=" + id).header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                    .andExpect(status().isNotFound());
            mvc.perform(get("/api/v1/stats/players?tournamentId=" + id).header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                    .andExpect(status().isNotFound());
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_record_events", Long.class)).isZero();
    }
    @Test void receiptIncludesSelectionButRenameDoesNotInvalidateOrDuplicateSavedMatch() {
        var t = tournament(); var key = UUID.randomUUID();
        var input = input(null, t.id(), TournamentStage.GROUP, true, MatchKind.EXTERNAL);
        var created = scoped(() -> saves.save(key, null, input));
        assertThat(scoped(() -> saves.save(key, null, input)).id()).isEqualTo(created.id());
        assertThatThrownBy(() -> scoped(() -> saves.save(key, null, input(null, t.id(), TournamentStage.FINAL, true, MatchKind.EXTERNAL))))
                .isInstanceOfSatisfying(TeamAccessException.class, e -> assertThat(e.code()).isEqualTo("REQUEST_CHANGED"));
        scoped(() -> tournaments.update(t.id(), tournamentInput("현재 대회명", t.version())));
        var replay = scoped(() -> saves.save(key, null, input));
        assertThat(replay.tournamentName()).isEqualTo("현재 대회명"); assertThat(replay.version()).isEqualTo(created.version());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records", Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_record_events", Long.class)).isEqualTo(1);
    }
    @Test void databaseRejectsCrossTeamForeignKeyInternalAndOrphanStage() {
        var t = tournament();
        var other = scoped(2, () -> tournaments.create(tournamentInput("타팀", null)));
        var game = scoped(() -> matches.create(input(null, null, null, null, MatchKind.EXTERNAL)));
        assertThatThrownBy(() -> jdbc.update("UPDATE match_records SET tournament_id=? WHERE id=?", other.id(), game.id())).isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE match_records SET tournament_stage='FINAL' WHERE id=?", game.id())).isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE match_records SET match_kind='INTERNAL',tournament_id=? WHERE id=?", t.id(), game.id())).isInstanceOf(DataAccessException.class);
    }
    @Test void statsAndDetailShareTournamentFilterSubstitutionCreditAndReflectReassignment() {
        var first = tournament(); var second = scoped(() -> tournaments.create(tournamentInput("두 번째 대회", null)));
        jdbc.update("INSERT INTO players(team_id,name,shirt_number,position,first_choice,active,player_type) VALUES (1,'가상 선수',7,'MF','CM',1,'MEMBER'),(1,'가상 용병',NULL,'MF','CM',1,'GUEST')");
        long member = jdbc.queryForObject("SELECT id FROM players WHERE shirt_number=7", Long.class);
        long guest = jdbc.queryForObject("SELECT id FROM players WHERE player_type='GUEST'", Long.class);
        var a = scoped(() -> matches.create(input(null, first.id(), TournamentStage.GROUP, true, MatchKind.EXTERNAL)));
        var b = scoped(() -> matches.create(input(null, second.id(), TournamentStage.FINAL, true, MatchKind.EXTERNAL)));
        for (var m : List.of(a, b)) {
            jdbc.update("INSERT INTO match_participants(match_id,player_id,vote,attendance) VALUES (?,?,'ATTENDING','PRESENT')", m.id(), member);
            jdbc.update("INSERT INTO match_appearances(match_id,quarter_number,team,slot,entry_order,player_id,goals,assists) VALUES (?,1,'A','ST',0,?,2,0),(?,1,'A','ST',1,?,1,0)", m.id(), member, m.id(), guest);
        }
        var season = scoped(() -> stats.list(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, first.id()));
        var detail = scoped(() -> stats.matches(member, today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0, first.id()));
        assertThat(season.tournamentId()).isEqualTo(first.id()); assertThat(season.matchCount()).isEqualTo(1);
        assertThat(detail.player()).isEqualTo(season.items().getFirst());
        assertThat(detail.player().creditedQuarters()).isEqualTo(0.5);
        assertThat(detail.items()).singleElement().satisfies(row -> {
            assertThat(row.matchId()).isEqualTo(a.id()); assertThat(row.tournamentId()).isEqualTo(first.id());
            assertThat(row.tournamentName()).isEqualTo(first.name()); assertThat(row.tournamentStage()).isEqualTo("GROUP");
            assertThat(row.kickoff()).isEqualTo(LocalTime.of(11, 0));
        });
        assertThatThrownBy(() -> scoped(() -> stats.list(today.getYear(), StatsMatchKind.INTERNAL, StatsRecordScope.ALL, true, first.id())))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> scoped(() -> stats.matches(member, today.getYear(), StatsMatchKind.INTERNAL, StatsRecordScope.ALL, true, 0, first.id())))
                .isInstanceOf(IllegalArgumentException.class);
        jdbc.update("UPDATE match_records SET tournament_id=? WHERE id=?", second.id(), a.id());
        assertThat(scoped(() -> stats.matches(member, today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0, first.id())).items()).isEmpty();
        assertThat(scoped(() -> stats.matches(member, today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0, second.id())).totalElements()).isEqualTo(2);
    }
}
