package com.jochookon.common;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.jochookon.match.*;
import com.jochookon.stats.*;
import com.jochookon.team.*;
import com.jochookon.tournament.*;
import java.time.*;
import java.util.*;
import java.util.function.Supplier;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.mysql.MySQLContainer;

@Tag("integration") @Testcontainers
@SpringBootTest(properties = {"spring.datasource.password=unused-test-password", "jochookon.bootstrap.admin.username=",
        "jochookon.bootstrap.admin.password=", "jochookon.bootstrap.service-admin-username="})
@AutoConfigureMockMvc
class CalendarPeriodIntegrationTest {
    @Container @ServiceConnection static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Autowired JdbcTemplate jdbc;
    @Autowired MatchService matches;
    @Autowired TournamentService tournaments;
    @Autowired PlayerStatsService stats;
    @Autowired MockMvc mvc;
    final LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
    @BeforeEach void seed() {
        TeamTestData.seed(jdbc);
        jdbc.update("INSERT INTO teams(id,name,status) VALUES (2,'기간 조회 가상 팀','ACTIVE') ON DUPLICATE KEY UPDATE status='ACTIVE'");
        for (String table : List.of("match_save_requests", "match_record_events", "match_planned_lineups", "match_appearances",
                "match_quarters", "match_participants", "match_records", "tournaments", "players")) jdbc.update("DELETE FROM " + table);
        jdbc.update("INSERT INTO players(id,team_id,name,shirt_number,position,first_choice,active,player_type) VALUES (9001,1,'월별 가상 선수',7,'MF','CM',1,'MEMBER'),(9002,1,'월별 가상 용병',NULL,'MF','CM',1,'GUEST')");
    }
    @AfterEach void clear() { TeamContext.clear(); }
    private <T> T scoped(long team, Supplier<T> work) {
        TeamContext.set(team); try { return work.get(); } finally { TeamContext.clear(); }
    }
    private <T> T scoped(Supplier<T> work) { return scoped(1, work); }
    private long tournament(long team, String from, String through) {
        jdbc.update("INSERT INTO tournaments(team_id,name,start_date,end_date) VALUES (?,'기간 조회 가상 대회',?,?)", team, from, through);
        return jdbc.queryForObject("SELECT MAX(id) FROM tournaments", Long.class);
    }
    private long match(long team, String date, String kind, String stage, Long tournament) {
        jdbc.update("INSERT INTO match_records(team_id,played_on,kickoff,venue,opponent,notes,match_kind,recording_stage,tournament_id) VALUES (?,?,'11:00:00','','','기간 조회 검증',?,?,?)",
                team, date, kind, stage, tournament);
        return jdbc.queryForObject("SELECT MAX(id) FROM match_records", Long.class);
    }
    private void appearance(long match, long player, int entry, int goals, int fk, int pk) {
        jdbc.update("INSERT INTO match_participants(match_id,player_id,vote,attendance) VALUES (?,?,'ATTENDING','PRESENT')", match, player);
        jdbc.update("INSERT INTO match_appearances(match_id,quarter_number,team,slot,entry_order,player_id,goals,assists,free_kick_goals,penalty_goals) VALUES (?,1,'A','ST',?,?,?,1,?,?)",
                match, entry, player, goals, fk, pk);
    }
    @Test void matchYearMonthUsesDatabasePagingLeapDayAndCurrentTeamYearChoices() throws Exception {
        long cup = tournament(1, "2024-02-01", "2024-02-29");
        var league = new ArrayList<Long>();
        for (int day = 1; day <= 12; day++) league.add(match(1, LocalDate.of(2024, 2, day).toString(), day % 2 == 0 ? "INTERNAL" : "EXTERNAL", "COMPLETED", null));
        long leapDay = match(1, "2024-02-29", "EXTERNAL", "COMPLETED", cup);
        match(1, "2024-01-31", "EXTERNAL", "COMPLETED", null);
        match(1, "2024-03-01", "INTERNAL", "COMPLETED", null);
        match(1, "2023-12-31", "EXTERNAL", "COMPLETED", null);
        match(2, "2030-02-28", "EXTERNAL", "COMPLETED", null);
        Collections.reverse(league);
        var first = scoped(() -> matches.list(0, 10, null, CompetitionScope.LEAGUE, 2024, 2));
        var second = scoped(() -> matches.list(1, 10, null, CompetitionScope.LEAGUE, 2024, 2));
        assertThat(first.totalElements()).isEqualTo(12); assertThat(first.totalPages()).isEqualTo(2);
        assertThat(first.items().stream().map(MatchResponse.Summary::id)).containsExactlyElementsOf(league.subList(0, 10));
        assertThat(second.items().stream().map(MatchResponse.Summary::id)).containsExactlyElementsOf(league.subList(10, 12));
        assertThat(scoped(() -> matches.list(0, 100, null, CompetitionScope.ALL, 2024, 2)).totalElements()).isEqualTo(13);
        assertThat(scoped(() -> matches.list(0, 100, null, CompetitionScope.ALL, 2024, null)).totalElements()).isEqualTo(15);
        assertThat(scoped(() -> matches.list(0, 100)).totalElements()).isEqualTo(16);
        assertThat(scoped(() -> matches.list(0, 10, cup, CompetitionScope.TOURNAMENT, 2024, 2)).items())
                .singleElement().satisfies(row -> assertThat(row.id()).isEqualTo(leapDay));
        assertThat(scoped(() -> matches.years())).containsExactly(2024, 2023);
        assertThat(scoped(2, () -> matches.years())).containsExactly(2030);
        mvc.perform(get("/api/v1/matches/years").header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(content().json("[2024,2023]"));
        mvc.perform(get("/api/v1/matches?year=2024&month=2&competitionScope=LEAGUE&page=1").header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(12)).andExpect(jsonPath("$.items.length()").value(2));
        var acrossYears = scoped(() -> matches.list(1, 10, null, CompetitionScope.LEAGUE, null, null, "2023-12", "2024-02"));
        assertThat(acrossYears.totalElements()).isEqualTo(14); assertThat(acrossYears.totalPages()).isEqualTo(2);
        assertThat(acrossYears.items()).hasSize(4).allSatisfy(row -> assertThat(row.playedOn()).isBetween(LocalDate.of(2023, 12, 1), LocalDate.of(2024, 2, 29)));
        assertThat(scoped(() -> matches.list(0, 100, null, CompetitionScope.ALL, null, null, "2023-12", "2024-02")).totalElements()).isEqualTo(15);
        assertThat(scoped(() -> matches.list(0, 100, cup, CompetitionScope.TOURNAMENT, null, null, "2023-12", "2024-02")).items())
                .singleElement().satisfies(row -> assertThat(row.id()).isEqualTo(leapDay));
        mvc.perform(get("/api/v1/matches?startMonth=2023-12&endMonth=2024-02&competitionScope=LEAGUE&page=1").header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(14)).andExpect(jsonPath("$.items.length()").value(4));
    }
    @Test void tournamentsOverlapMonthAndYearInclusivelyAndYearsExpandTheWholePeriod() throws Exception {
        long multiYear = tournament(1, "2023-12-31", "2025-01-01");
        long firstBoundary = tournament(1, "2024-01-31", "2024-02-01");
        long lastBoundary = tournament(1, "2024-02-29", "2024-03-01");
        tournament(1, "2024-01-01", "2024-01-31"); tournament(1, "2024-03-01", "2024-03-31");
        tournament(2, "2030-01-01", "2031-01-01");
        var february = scoped(() -> tournaments.list(0, 100, 2024, 2));
        assertThat(february.totalElements()).isEqualTo(3);
        assertThat(february.items().stream().map(TournamentResponse::id)).containsExactly(lastBoundary, firstBoundary, multiYear);
        var page = scoped(() -> tournaments.list(1, 1, 2024, 2));
        assertThat(page.totalPages()).isEqualTo(3); assertThat(page.items()).singleElement().satisfies(row -> assertThat(row.id()).isEqualTo(firstBoundary));
        assertThat(scoped(() -> tournaments.list(0, 100, 2024, null)).totalElements()).isEqualTo(5);
        assertThat(scoped(() -> tournaments.list(0, 100, 2025, 1)).items()).singleElement().satisfies(row -> assertThat(row.id()).isEqualTo(multiYear));
        assertThat(scoped(() -> tournaments.list(0, 100, 2025, 2)).items()).isEmpty();
        assertThat(scoped(() -> tournaments.years())).containsExactly(2025, 2024, 2023);
        assertThat(scoped(2, () -> tournaments.years())).containsExactly(2031, 2030);
        mvc.perform(get("/api/v1/tournaments/years").header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(content().json("[2025,2024,2023]"));
        mvc.perform(get("/api/v1/tournaments?year=2024&month=2&page=1&size=1").header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(3)).andExpect(jsonPath("$.items[0].id").value(firstBoundary));
        var range = scoped(() -> tournaments.list(0, 100, null, null, "2023-12", "2024-02"));
        assertThat(range.totalElements()).isEqualTo(4);
        assertThat(range.items()).allSatisfy(row -> {
            assertThat(row.startDate()).isBeforeOrEqualTo(LocalDate.of(2024, 2, 29));
            assertThat(row.endDate()).isAfterOrEqualTo(LocalDate.of(2023, 12, 1));
        });
        mvc.perform(get("/api/v1/tournaments?startMonth=2023-12&endMonth=2024-02&page=1&size=2").header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(4)).andExpect(jsonPath("$.items.length()").value(2));
    }
    @Test void statsMonthMatchesDetailTotalsFiltersAndHalfCreditWithoutNarrowingYearChoices() throws Exception {
        long cup = tournament(1, "2024-02-01", "2024-02-29");
        long league = match(1, "2024-02-01", "EXTERNAL", "COMPLETED", null);
        long internal = match(1, "2024-02-29", "INTERNAL", "COMPLETED", null);
        long tournament = match(1, "2024-02-29", "EXTERNAL", "COMPLETED", cup);
        appearance(league, 9001, 0, 2, 1, 0); appearance(league, 9002, 1, 1, 0, 1);
        appearance(internal, 9001, 0, 3, 1, 1); appearance(tournament, 9001, 0, 5, 2, 2);
        appearance(match(1, "2024-01-31", "EXTERNAL", "COMPLETED", null), 9001, 0, 7, 0, 0);
        appearance(match(1, "2024-03-01", "EXTERNAL", "COMPLETED", null), 9001, 0, 11, 0, 0);
        appearance(match(1, "2023-10-01", "INTERNAL", "COMPLETED", null), 9001, 0, 9, 0, 0);
        appearance(match(1, "2024-02-05", "EXTERNAL", null, null), 9001, 0, 13, 0, 0);
        appearance(match(1, "2024-02-06", "EXTERNAL", "ACTUAL", null), 9001, 0, 17, 0, 0);
        appearance(match(1, today.plusDays(1).toString(), "EXTERNAL", "COMPLETED", null), 9001, 0, 90, 0, 0);
        match(2, "2022-02-01", "EXTERNAL", "COMPLETED", null);
        for (var scope : CompetitionScope.values()) {
            var list = scoped(() -> stats.list(2024, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, scope, 2));
            var detail = scoped(() -> stats.matches(9001, 2024, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, 0, null, scope, 2));
            assertThat(list.month()).isEqualTo(2); assertThat(detail.month()).isEqualTo(2);
            assertThat(detail.player()).isEqualTo(list.items().getFirst());
            assertThat(detail.totalElements()).isEqualTo(list.matchCount());
            assertThat(detail.items()).allSatisfy(row -> assertThat(row.playedOn().getMonthValue()).isEqualTo(2));
            assertThat(detail.items().stream().mapToLong(PlayerMatchStatsResponse.Item::goals).sum()).isEqualTo(detail.player().goals());
            assertThat(detail.items().stream().mapToLong(PlayerMatchStatsResponse.Item::freeKickGoals).sum()).isEqualTo(detail.player().freeKickGoals());
            assertThat(detail.items().stream().mapToLong(PlayerMatchStatsResponse.Item::penaltyGoals).sum()).isEqualTo(detail.player().penaltyGoals());
            assertThat(detail.items().stream().mapToDouble(PlayerMatchStatsResponse.Item::creditedQuarters).sum()).isEqualTo(detail.player().creditedQuarters());
            assertThat(list.availableYears()).isEqualTo(scoped(() -> stats.list(2024, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, scope)).availableYears());
            if (scope == CompetitionScope.ALL) { assertThat(detail.player().goals()).isEqualTo(10); assertThat(detail.player().creditedQuarters()).isEqualTo(2.5); }
            if (scope == CompetitionScope.LEAGUE) { assertThat(detail.player().goals()).isEqualTo(5); assertThat(detail.player().creditedQuarters()).isEqualTo(1.5); }
        }
        var february = scoped(() -> stats.list(2024, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, 2));
        assertThat(february.availableYears()).contains(2023).doesNotContain(2022);
        assertThat(scoped(() -> stats.list(2024, StatsMatchKind.ALL, StatsRecordScope.RECORDED, false, null, CompetitionScope.ALL, 2)).items().getFirst().goals()).isEqualTo(23);
        assertThat(scoped(() -> stats.list(2024, StatsMatchKind.ALL, StatsRecordScope.ALL, false, null, CompetitionScope.ALL, 2)).items().getFirst().goals()).isEqualTo(40);
        assertThat(scoped(() -> stats.matches(9001, 2024, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, 0, cup, CompetitionScope.TOURNAMENT, 2)).player().goals()).isEqualTo(5);
        assertThat(scoped(() -> stats.matches(9001, 2024, StatsMatchKind.INTERNAL, StatsRecordScope.COMPLETED, false, 0, null, CompetitionScope.LEAGUE, 2)).player().goals()).isEqualTo(3);
        assertThat(scoped(() -> stats.matches(9002, 2024, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, true, 0, null, CompetitionScope.LEAGUE, 2)).player().creditedQuarters()).isEqualTo(0.5);
        var future = today.plusDays(1);
        assertThat(scoped(() -> stats.list(future.getYear(), StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, future.getMonthValue())).matchCount()).isZero();
        mvc.perform(get("/api/v1/stats/players/9001/matches?year=2024&month=2&kind=ALL").header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.month").value(2)).andExpect(jsonPath("$.player.goals").value(10)).andExpect(jsonPath("$.totalElements").value(3));
    }
    @Test void statsCrossYearRangeKeepsFullSummaryOnEveryPageAndMatchesMonthlySumsWithoutForeignOrFutureData() throws Exception {
        long cup = tournament(1, "2023-12-01", "2024-02-29");
        var leagueIds = new ArrayList<Long>();
        for (int i = 0; i < 11; i++) {
            String date = i < 5 ? LocalDate.of(2023, 12, i + 1).toString() : LocalDate.of(2024, 1, i - 4).toString();
            long game = match(1, date, i % 2 == 0 ? "INTERNAL" : "EXTERNAL", "COMPLETED", null);
            leagueIds.add(game); appearance(game, 9001, 0, 1, 0, 1);
        }
        appearance(leagueIds.getFirst(), 9002, 1, 1, 0, 1);
        long lastDay = match(1, "2024-02-29", "EXTERNAL", "COMPLETED", cup);
        appearance(lastDay, 9001, 0, 3, 1, 1);
        appearance(match(1, "2023-11-30", "EXTERNAL", "COMPLETED", null), 9001, 0, 70, 0, 0);
        appearance(match(1, "2024-03-01", "EXTERNAL", "COMPLETED", null), 9001, 0, 80, 0, 0);
        appearance(match(1, "2022-09-01", "EXTERNAL", "COMPLETED", null), 9001, 0, 90, 0, 0);
        match(2, "2023-12-01", "EXTERNAL", "COMPLETED", null);
        var all = scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, null, "2023-12", "2024-02"));
        assertThat(all.year()).isEqualTo(2023); assertThat(all.startMonth()).isEqualTo("2023-12"); assertThat(all.endMonth()).isEqualTo("2024-02");
        assertThat(all.month()).isNull(); assertThat(all.matchCount()).isEqualTo(12);
        assertThat(all.items().getFirst().goals()).isEqualTo(14); assertThat(all.items().getFirst().creditedQuarters()).isEqualTo(11.5);
        assertThat(all.availableYears()).contains(2022);
        var collected = new ArrayList<PlayerMatchStatsResponse.Item>();
        for (int page = 0; page < 2; page++) {
            int currentPage = page;
            var detail = scoped(() -> stats.matches(9001, null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, currentPage, null, CompetitionScope.ALL, null, "2023-12", "2024-02"));
            assertThat(detail.player()).isEqualTo(all.items().getFirst());
            assertThat(detail.totalElements()).isEqualTo(12); assertThat(detail.totalPages()).isEqualTo(2);
            assertThat(detail.items()).hasSize(page == 0 ? 10 : 2);
            assertThat(detail.startMonth()).isEqualTo("2023-12"); assertThat(detail.endMonth()).isEqualTo("2024-02");
            collected.addAll(detail.items());
        }
        assertThat(collected.stream().map(PlayerMatchStatsResponse.Item::matchId)).doesNotHaveDuplicates();
        assertThat(collected.stream().mapToLong(PlayerMatchStatsResponse.Item::goals).sum()).isEqualTo(14);
        assertThat(collected.stream().mapToLong(PlayerMatchStatsResponse.Item::freeKickGoals).sum()).isEqualTo(1);
        assertThat(collected.stream().mapToLong(PlayerMatchStatsResponse.Item::penaltyGoals).sum()).isEqualTo(12);
        assertThat(collected.stream().mapToDouble(PlayerMatchStatsResponse.Item::creditedQuarters).sum()).isEqualTo(11.5);
        long monthlyGoals = 0;
        for (var month : List.of(YearMonth.of(2023, 12), YearMonth.of(2024, 1), YearMonth.of(2024, 2))) {
            monthlyGoals += scoped(() -> stats.list(month.getYear(), StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, month.getMonthValue())).items().getFirst().goals();
        }
        assertThat(monthlyGoals).isEqualTo(all.items().getFirst().goals());
        var league = scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.LEAGUE, null, "2023-12", "2024-02"));
        var tournament = scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, cup, CompetitionScope.TOURNAMENT, null, "2023-12", "2024-02"));
        assertThat(league.items().getFirst().goals() + tournament.items().getFirst().goals()).isEqualTo(14);
        assertThat(scoped(() -> stats.matches(9002, null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, true, 0, null, CompetitionScope.LEAGUE, null, "2023-12", "2024-02")).player().creditedQuarters()).isEqualTo(0.5);
        assertThat(scoped(2, () -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, null, "2023-12", "2024-02")).items()).isEmpty();
        appearance(match(1, today.plusDays(1).toString(), "EXTERNAL", "COMPLETED", null), 9001, 0, 99, 0, 0);
        var current = YearMonth.from(today).toString(); var next = YearMonth.from(today).plusMonths(1).toString();
        assertThat(scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, null, current, next)).matchCount()).isZero();
        mvc.perform(get("/api/v1/stats/players/9001/matches?startMonth=2023-12&endMonth=2024-02&kind=ALL&page=1").header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.startMonth").value("2023-12")).andExpect(jsonPath("$.endMonth").value("2024-02"))
                .andExpect(jsonPath("$.year").value(2023)).andExpect(jsonPath("$.player.goals").value(14)).andExpect(jsonPath("$.totalElements").value(12)).andExpect(jsonPath("$.items.length()").value(2));
    }
    @Test void concededGoalsCountOnlyExternalScoresOnceWithZeroMissingInternalAndPeriodCoverage() throws Exception {
        long cup = tournament(1, "2023-12-01", "2024-02-29");
        long first = match(1, "2023-12-01", "EXTERNAL", "COMPLETED", null);
        long zero = match(1, "2024-01-01", "EXTERNAL", "COMPLETED", null);
        match(1, "2024-02-01", "EXTERNAL", "COMPLETED", null);
        long tournament = match(1, "2023-12-02", "EXTERNAL", "COMPLETED", cup);
        long internal = match(1, "2024-01-02", "INTERNAL", "COMPLETED", null);
        long partial = match(1, "2024-01-03", "EXTERNAL", "ACTUAL", null);
        long outside = match(1, "2024-03-01", "EXTERNAL", "COMPLETED", null);
        long foreign = match(2, "2023-12-01", "EXTERNAL", "COMPLETED", null);
        jdbc.update("UPDATE match_records SET score_for=0,score_against=CASE id WHEN ? THEN 2 WHEN ? THEN 0 WHEN ? THEN 3 WHEN ? THEN 9 WHEN ? THEN 50 WHEN ? THEN 30 WHEN ? THEN 40 END WHERE id IN (?,?,?,?,?,?,?)",
                first, zero, tournament, internal, partial, outside, foreign, first, zero, tournament, internal, partial, outside, foreign);
        appearance(first, 9001, 0, 2, 1, 0); appearance(first, 9002, 1, 1, 0, 1);
        var all = scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, null, "2023-12", "2024-02"));
        assertThat(all.goalsAgainst()).isEqualTo(5);
        assertThat(all.scoredExternalMatchCount()).isEqualTo(3); assertThat(all.missingExternalScoreCount()).isEqualTo(1);
        assertThat(all.excludedInternalMatchCount()).isEqualTo(1); assertThat(all.internalMatchCount()).isEqualTo(1);
        assertThat(all.externalMatchCount()).isEqualTo(4); assertThat(all.matchCount()).isEqualTo(5);
        assertThat(all.matchCount()).isEqualTo(all.externalMatchCount() + all.internalMatchCount());
        assertThat(all.externalMatchCount()).isEqualTo(all.scoredExternalMatchCount() + all.missingExternalScoreCount());
        var guests = scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, true, null, CompetitionScope.ALL, null, "2023-12", "2024-02"));
        assertThat(guests.goalsAgainst()).isEqualTo(all.goalsAgainst()); assertThat(guests.matchCount()).isEqualTo(all.matchCount());
        var league = scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.LEAGUE, null, "2023-12", "2024-02"));
        assertThat(league.goalsAgainst()).isEqualTo(2); assertThat(league.externalMatchCount()).isEqualTo(3); assertThat(league.internalMatchCount()).isEqualTo(1);
        var cupOnly = scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, cup, CompetitionScope.TOURNAMENT, null, "2023-12", "2024-02"));
        assertThat(cupOnly.goalsAgainst()).isEqualTo(3); assertThat(cupOnly.scoredExternalMatchCount()).isEqualTo(1);
        var external = scoped(() -> stats.list(null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, null, "2023-12", "2024-02"));
        assertThat(external.goalsAgainst()).isEqualTo(5); assertThat(external.internalMatchCount()).isZero(); assertThat(external.matchCount()).isEqualTo(4);
        var internalOnly = scoped(() -> stats.list(null, StatsMatchKind.INTERNAL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.LEAGUE, null, "2023-12", "2024-02"));
        assertThat(internalOnly.goalsAgainst()).isNull(); assertThat(internalOnly.scoredExternalMatchCount()).isZero();
        assertThat(internalOnly.missingExternalScoreCount()).isZero(); assertThat(internalOnly.internalMatchCount()).isEqualTo(1);
        var zeroOnly = scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, null, "2024-01", "2024-01"));
        assertThat(zeroOnly.goalsAgainst()).isZero(); assertThat(zeroOnly.scoredExternalMatchCount()).isEqualTo(1);
        var missingOnly = scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, null, "2024-02", "2024-02"));
        assertThat(missingOnly.goalsAgainst()).isNull(); assertThat(missingOnly.scoredExternalMatchCount()).isZero(); assertThat(missingOnly.missingExternalScoreCount()).isEqualTo(1);
        var empty = scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, null, "2024-04", "2024-04"));
        assertThat(empty.goalsAgainst()).isNull(); assertThat(empty.externalMatchCount()).isZero(); assertThat(empty.internalMatchCount()).isZero();
        assertThat(scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.ALL, false, null, CompetitionScope.ALL, null, "2023-12", "2024-02")).goalsAgainst()).isEqualTo(55);
        assertThat(scoped(2, () -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, null, "2023-12", "2024-02")).goalsAgainst()).isEqualTo(40);
        var before = scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, null, "2023-12", "9999-12"));
        long future = match(1, today.plusDays(1).toString(), "EXTERNAL", "COMPLETED", null);
        jdbc.update("UPDATE match_records SET score_for=0,score_against=99 WHERE id=?", future);
        var after = scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, null, "2023-12", "9999-12"));
        assertThat(after.goalsAgainst()).isEqualTo(before.goalsAgainst()); assertThat(after.matchCount()).isEqualTo(before.matchCount());
        mvc.perform(get("/api/v1/stats/players?startMonth=2023-12&endMonth=2024-02&kind=ALL").header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.goalsAgainst").value(5)).andExpect(jsonPath("$.scoredExternalMatchCount").value(3))
                .andExpect(jsonPath("$.missingExternalScoreCount").value(1)).andExpect(jsonPath("$.externalMatchCount").value(4)).andExpect(jsonPath("$.internalMatchCount").value(1));
    }
    @Test void allTimeCoversStoredHistoryAndPersonalDetailsButKeepsAllOtherFiltersAndDefaultYear() throws Exception {
        long cup = tournament(1, today.toString(), today.toString());
        long oldest = match(1, "1000-01-01", "EXTERNAL", "COMPLETED", null);
        long previous = match(1, "2023-09-01", "INTERNAL", "COMPLETED", null);
        long current = match(1, today.toString(), "EXTERNAL", "COMPLETED", cup);
        appearance(oldest, 9001, 0, 2, 1, 1); appearance(oldest, 9002, 1, 1, 0, 1);
        appearance(previous, 9001, 0, 3, 1, 1); appearance(current, 9001, 0, 5, 2, 2);
        appearance(match(1, "2004-01-01", "EXTERNAL", null, null), 9001, 0, 7, 0, 0);
        appearance(match(1, "2010-01-01", "EXTERNAL", "ACTUAL", null), 9001, 0, 11, 0, 0);
        appearance(match(1, today.plusDays(1).toString(), "EXTERNAL", "COMPLETED", null), 9001, 0, 99, 0, 0);
        match(2, "2015-01-01", "EXTERNAL", "COMPLETED", null);
        jdbc.update("UPDATE match_records SET score_for=0,score_against=2 WHERE id=?", oldest);
        jdbc.update("UPDATE match_records SET score_for=0,score_against=9 WHERE id=?", previous);
        jdbc.update("UPDATE match_records SET score_for=0,score_against=3 WHERE id=?", current);
        var all = scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, null, null, null, true));
        var detail = scoped(() -> stats.matches(9001, null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, 0, null, CompetitionScope.ALL, null, null, null, true));
        assertThat(all.allTime()).isTrue(); assertThat(detail.allTime()).isTrue();
        assertThat(all.month()).isNull(); assertThat(all.startMonth()).isNull(); assertThat(all.endMonth()).isNull();
        assertThat(all.matchCount()).isEqualTo(3); assertThat(detail.totalElements()).isEqualTo(3);
        assertThat(detail.player()).isEqualTo(all.items().getFirst());
        assertThat(detail.player().goals()).isEqualTo(10); assertThat(detail.player().creditedQuarters()).isEqualTo(2.5);
        assertThat(detail.items().stream().map(PlayerMatchStatsResponse.Item::matchId)).containsExactly(current, previous, oldest);
        assertThat(detail.items().stream().mapToLong(PlayerMatchStatsResponse.Item::goals).sum()).isEqualTo(detail.player().goals());
        assertThat(detail.items().stream().mapToLong(PlayerMatchStatsResponse.Item::freeKickGoals).sum()).isEqualTo(detail.player().freeKickGoals()).isEqualTo(4);
        assertThat(detail.items().stream().mapToLong(PlayerMatchStatsResponse.Item::penaltyGoals).sum()).isEqualTo(detail.player().penaltyGoals()).isEqualTo(4);
        assertThat(all.goalsAgainst()).isEqualTo(5); assertThat(all.externalMatchCount()).isEqualTo(2); assertThat(all.internalMatchCount()).isEqualTo(1);
        assertThat(all.availableYears()).containsExactly(today.getYear(), 2023, 1000);
        var defaultYear = scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false));
        assertThat(defaultYear.allTime()).isFalse(); assertThat(defaultYear.year()).isEqualTo(today.getYear());
        assertThat(defaultYear.matchCount()).isEqualTo(1); assertThat(defaultYear.items().getFirst().goals()).isEqualTo(5);
        assertThat(defaultYear.availableYears()).isEqualTo(all.availableYears());
        assertThat(scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.RECORDED, false, null, CompetitionScope.ALL, null, null, null, true)).items().getFirst().goals()).isEqualTo(17);
        assertThat(scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.ALL, false, null, CompetitionScope.ALL, null, null, null, true)).items().getFirst().goals()).isEqualTo(28);
        assertThat(scoped(() -> stats.list(null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, null, null, null, true)).items().getFirst().goals()).isEqualTo(7);
        assertThat(scoped(() -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.LEAGUE, null, null, null, true)).items().getFirst().goals()).isEqualTo(5);
        assertThat(scoped(() -> stats.matches(9001, null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, 0, cup, CompetitionScope.TOURNAMENT, null, null, null, true)).items())
                .singleElement().satisfies(row -> assertThat(row.matchId()).isEqualTo(current));
        assertThat(scoped(() -> stats.matches(9001, null, StatsMatchKind.INTERNAL, StatsRecordScope.COMPLETED, false, 0, null, CompetitionScope.LEAGUE, null, null, null, true)).player().goals()).isEqualTo(3);
        assertThat(scoped(() -> stats.matches(9002, null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, true, 0, null, CompetitionScope.LEAGUE, null, null, null, true)).player().creditedQuarters()).isEqualTo(0.5);
        assertThatThrownBy(() -> scoped(() -> stats.matches(9002, null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, 0, null, CompetitionScope.ALL, null, null, null, true)))
                .hasMessage("현재 조건에서 선수 기록을 찾을 수 없습니다.");
        assertThat(scoped(2, () -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, null, null, null, true)).matchCount()).isEqualTo(1);
        assertThat(scoped(2, () -> stats.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, null, null, null, true)).items()).isEmpty();
        mvc.perform(get("/api/v1/stats/players?allTime=true&kind=ALL").header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.allTime").value(true)).andExpect(jsonPath("$.items[0].goals").value(10)).andExpect(jsonPath("$.matchCount").value(3));
        mvc.perform(get("/api/v1/stats/players/9001/matches?allTime=true&kind=ALL").header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.allTime").value(true)).andExpect(jsonPath("$.player.goals").value(10)).andExpect(jsonPath("$.totalElements").value(3));
    }
}
