package com.jochookon.match;

import static com.jochookon.match.MatchTestData.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static com.jochookon.player.TeamScopedRequests.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.mysql.MySQLContainer;
import tools.jackson.databind.ObjectMapper;

@Tag("integration") @Testcontainers @SpringBootTest(properties = {"spring.datasource.password=unused-test-password",
        "jochookon.bootstrap.admin.username=", "jochookon.bootstrap.admin.password=",
        "jochookon.bootstrap.service-admin-username="})
@AutoConfigureMockMvc @WithMockUser(username = "test-admin", roles = "DIRECTOR")
class MatchIntegrationTest {
    @Container @ServiceConnection static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    long first; long second;
    @BeforeEach void seedIsolatedDatabase() {
        com.jochookon.team.TeamTestData.seed(jdbc);
        jdbc.update("DELETE FROM match_record_events");
        jdbc.update("DELETE FROM match_planned_lineups");
        jdbc.update("DELETE FROM match_appearances"); jdbc.update("DELETE FROM match_quarters");
        jdbc.update("DELETE FROM match_participants"); jdbc.update("DELETE FROM match_records"); jdbc.update("DELETE FROM players");
        jdbc.update("INSERT INTO players(team_id,name, position) VALUES (1,'검증 선수 A', 'FW'),(1,'검증 선수 B', 'GK')");
        var ids = jdbc.queryForList("SELECT id FROM players ORDER BY id", Long.class); first = ids.get(0); second = ids.get(1);
    }
    long create(MatchRequest request) throws Exception {
        var response = call(post("/api/v1/matches").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.version").value(0)).andReturn().getResponse();
        return json.readTree(response.getContentAsString()).get("id").asLong();
    }
    @Test void scoringOrderApiRoundTripAuditValidationAndLegacyEditing() throws Exception {
        var base = request(null, List.of(participant(first, Attendance.PRESENT)), List.of(appearance(LineupSlot.ST, first, 1, 0)));
        var quarters = new ArrayList<>(base.quarters());
        var goals = List.of(new MatchRequest.GoalEvent(first, null, GoalType.NORMAL, MatchTeam.A));
        quarters.set(0, new MatchRequest.Quarter(1, base.quarters().getFirst().lineup(), goals, 1, true, List.of(-1, 0), true));
        long id = create(formatted(base, MatchFormat.FOUR_QUARTERS, quarters, List.of(), null, null));
        call(get("/api/v1/matches/" + id)).andExpect(jsonPath("$.quarters[0].scoringOrder[0]").value(-1))
                .andExpect(jsonPath("$.quarters[0].scoringOrder[1]").value(0));
        assertThat(jdbc.queryForObject("SELECT scoring_order FROM match_quarters WHERE match_id=? AND quarter_number=1", String.class, id)).isEqualTo("[-1,0]");
        var legacy = formatted(base, MatchFormat.FOUR_QUARTERS, base.quarters(), List.of(), 0L, null);
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(legacy)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.quarters[0].scoringOrder[0]").value(-1));
        quarters.set(0, new MatchRequest.Quarter(1, base.quarters().getFirst().lineup(), goals, 1, true, List.of(0, 0), true));
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(formatted(base, MatchFormat.FOUR_QUARTERS, quarters, List.of(), 1L, null))))
                .andExpect(status().isBadRequest());
        call(get("/api/v1/matches/" + id)).andExpect(jsonPath("$.version").value(1)).andExpect(jsonPath("$.quarters[0].scoringOrder[0]").value(-1));
        quarters.set(0, new MatchRequest.Quarter(1, base.quarters().getFirst().lineup(), goals, 1, true, null, true));
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(formatted(base, MatchFormat.FOUR_QUARTERS, quarters, List.of(), 1L, null))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.quarters[0].scoringOrder").isEmpty())
                .andExpect(jsonPath("$.quarters[0].lineup[0].goals").value(1));
        var snapshot = jdbc.queryForObject("SELECT before_snapshot FROM match_record_events WHERE match_id=? ORDER BY id DESC LIMIT 1", String.class, id);
        assertThat(json.readTree(snapshot).get("quarters").get(0).get("scoringOrder").get(0).asInt()).isEqualTo(-1);
    }
    @Test void quarterConcededRoundTripLegacyPreservationClearAndAudit() throws Exception {
        var base = request(null, List.of(), List.of());
        var quarters = new ArrayList<>(base.quarters());
        quarters.set(0, new MatchRequest.Quarter(1, List.of(), List.of(), 2, true));
        long id = create(formatted(base, MatchFormat.FOUR_QUARTERS, quarters, List.of(), null, null));
        call(get("/api/v1/matches/" + id)).andExpect(jsonPath("$.quarters[0].goalsAgainst").value(2));
        assertThat(jdbc.queryForObject("SELECT goals_against FROM match_quarters WHERE match_id=? AND quarter_number=1", Integer.class, id)).isEqualTo(2);
        var legacy = formatted(base, MatchFormat.FOUR_QUARTERS, base.quarters(), List.of(), 0L, null);
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(legacy)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.quarters[0].goalsAgainst").value(2));
        quarters.set(0, new MatchRequest.Quarter(1, List.of(), List.of(), null, true));
        var cleared = formatted(base, MatchFormat.FOUR_QUARTERS, quarters, List.of(), 1L, null);
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(cleared)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.quarters[0].goalsAgainst").isEmpty());
        var snapshot = jdbc.queryForObject("SELECT before_snapshot FROM match_record_events WHERE match_id=? ORDER BY id DESC LIMIT 1", String.class, id);
        assertThat(json.readTree(snapshot).get("quarters").get(0).get("goalsAgainst").asInt()).isEqualTo(2);
    }
    private List<MatchRequest.Participant> plannedPeople(List<MatchRequest.Participant> people, List<MatchRequest.PlannedEntry> plan) {
        return people.stream().map(p -> new MatchRequest.Participant(p.playerId(), p.vote(), p.attendance(),
                plan.stream().filter(e -> e.playerId().equals(p.playerId())).map(MatchRequest.PlannedEntry::team).findFirst().orElse(null), true)).toList();
    }
    private MatchRequest formatted(MatchRequest base, MatchFormat format, List<MatchRequest.Quarter> quarters,
                                   List<MatchRequest.PlannedEntry> plan, Long version, Long tournament) {
        return new MatchRequest(base.playedOn(), base.kickoff(), base.venue(), base.opponent(), base.notes(), version,
                base.participants(), quarters, plan, base.scoreFor(), base.scoreAgainst(), base.kind(), base.recordingStage(),
                base.formationA(), base.formationB(), tournament, tournament == null ? null : TournamentStage.GROUP, true, format);
    }
    @Test void twoHalvesRoundTripHistoryOmittedUpdateAndIdempotencyWithoutDuplicatingMatch() throws Exception {
        var base = request(null, List.of(participant(first, Attendance.PRESENT)), List.of(appearance(LineupSlot.ST, first, 1, 0)));
        var halves = formatted(base, MatchFormat.TWO_HALVES_30, base.quarters().subList(0, 2), List.of(), null, null);
        String key = UUID.randomUUID().toString();
        var firstResult = call(post("/api/v1/matches").header("Idempotency-Key", key).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(halves)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.matchFormat").value("TWO_HALVES_30"))
                .andExpect(jsonPath("$.quarters.length()").value(2)).andReturn().getResponse();
        long id = json.readTree(firstResult.getContentAsString()).get("id").asLong();
        call(post("/api/v1/matches").header("Idempotency-Key", key).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(halves)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(id));
        call(get("/api/v1/matches")).andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.items[0].matchFormat").value("TWO_HALVES_30"));
        var changedFormat = formatted(base, MatchFormat.FOUR_QUARTERS, base.quarters(), List.of(), null, null);
        call(post("/api/v1/matches").header("Idempotency-Key", key).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(changedFormat)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("REQUEST_CHANGED"));
        var omitted = formatted(base, null, halves.quarters(), List.of(), 0L, null);
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(omitted)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.matchFormat").value("TWO_HALVES_30"));
        assertThat(jdbc.queryForObject("SELECT match_format FROM match_records WHERE id=?", String.class, id)).isEqualTo("TWO_HALVES_30");
        var snapshot = jdbc.queryForObject("SELECT after_snapshot FROM match_record_events WHERE match_id=? ORDER BY id DESC LIMIT 1", String.class, id);
        assertThat(json.readTree(snapshot).get("matchFormat").asText()).isEqualTo("TWO_HALVES_30");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_record_events WHERE match_id=?", Integer.class, id)).isEqualTo(2);
    }
    @Test void savedFourthQuarterCannotBeRemovedInSameFormatConversionAndInvalidPeriodsNeverWrite() throws Exception {
        var base = request(null, List.of(participant(first, Attendance.PRESENT)), List.of());
        var four = new ArrayList<>(base.quarters());
        four.set(3, new MatchRequest.Quarter(4, List.of(new MatchRequest.Appearance(LineupSlot.ST, first, 2, 0, 0, MatchTeam.A, 1, 1))));
        var plan = List.of(new MatchRequest.PlannedEntry(3, LineupSlot.GK, 0, first));
        long id = create(formatted(base, MatchFormat.FOUR_QUARTERS, four, plan, null, null));
        var saved = savedMatchRows(id);
        var half = formatted(base, MatchFormat.TWO_HALVES_30, base.quarters().subList(0, 2), List.of(), 0L, null);
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(half)))
                .andExpect(status().isBadRequest());
        assertThat(savedMatchRows(id)).isEqualTo(saved);
        for (var invalid : List.of(formatted(base, MatchFormat.TWO_HALVES_30, four, List.of(), null, null),
                formatted(base, MatchFormat.TWO_HALVES_30, base.quarters().subList(0, 2), plan, null, null)))
            call(post("/api/v1/matches").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(invalid)))
                    .andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records", Integer.class)).isEqualTo(1);
        assertThat(savedMatchRows(id)).isEqualTo(saved);
    }
    @Test void mixedLeagueAndTournamentFormatsAggregateRawQuarterCreditsAndRetainFormatInDetails() throws Exception {
        jdbc.update("INSERT INTO players(team_id,name,position) VALUES (1,'구간 검증 교체','FW')");
        long sub = jdbc.queryForObject("SELECT MAX(id) FROM players", Long.class);
        jdbc.update("INSERT INTO tournaments(team_id,name,start_date,end_date) VALUES (1,'전후반 검증 대회','2026-04-01','2026-04-30')");
        long tournament = jdbc.queryForObject("SELECT MAX(id) FROM tournaments", Long.class);
        var people = List.of(participant(first, Attendance.PRESENT), participant(second, Attendance.PRESENT), participant(sub, Attendance.PRESENT));
        var four = new ArrayList<MatchRequest.Quarter>();
        for (int q = 1; q <= 4; q++) four.add(new MatchRequest.Quarter(q, List.of(
                new MatchRequest.Appearance(LineupSlot.ST, first, q == 1 ? 2 : 0, 0, 0, MatchTeam.A, q == 1 ? 1 : 0, 0),
                new MatchRequest.Appearance(LineupSlot.GK, second, 0, q == 1 ? 1 : 0, 0))));
        var league = new MatchRequest(java.time.LocalDate.of(2026, 3, 8), java.time.LocalTime.of(11, 0), "", "검증 상대", "", null,
                people, four, List.of(), 2, 1, MatchKind.EXTERNAL, RecordingStage.COMPLETED, null, null, null, null, true, MatchFormat.FOUR_QUARTERS);
        create(league);
        var halves = List.of(new MatchRequest.Quarter(1, List.of(new MatchRequest.Appearance(LineupSlot.ST, first, 2, 0, 0, MatchTeam.A, 1, 1), new MatchRequest.Appearance(LineupSlot.GK, second, 0, 1, 0))),
                new MatchRequest.Quarter(2, List.of(new MatchRequest.Appearance(LineupSlot.ST, first, 1, 0, 0), new MatchRequest.Appearance(LineupSlot.ST, sub, 1, 1, 1), new MatchRequest.Appearance(LineupSlot.GK, second, 0, 0, 0))));
        var cup = new MatchRequest(java.time.LocalDate.of(2026, 4, 12), league.kickoff(), "", "검증 상대", "", null,
                people, halves, List.of(), 4, 2, MatchKind.EXTERNAL, RecordingStage.COMPLETED, null, null, tournament, TournamentStage.FINAL, true, MatchFormat.TWO_HALVES_30);
        long cupId = create(cup);
        call(get("/api/v1/stats/players/" + first + "/matches?year=2026"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.player.goals").value(5))
                .andExpect(jsonPath("$.player.creditedQuarters").value(5.5)).andExpect(jsonPath("$.player.freeKickGoals").value(2))
                .andExpect(jsonPath("$.player.penaltyGoals").value(1)).andExpect(jsonPath("$.items[0].matchFormat").value("TWO_HALVES_30"))
                .andExpect(jsonPath("$.items[1].matchFormat").value("FOUR_QUARTERS"));
        call(get("/api/v1/stats/players/" + first + "/matches?year=2026&competitionScope=TOURNAMENT&tournamentId=" + tournament))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.player.goals").value(3))
                .andExpect(jsonPath("$.player.creditedQuarters").value(1.5)).andExpect(jsonPath("$.items[0].matchId").value(cupId));
        call(get("/api/v1/stats/players/" + second + "/matches?startMonth=2026-04&endMonth=2026-04"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.player.creditedQuarters").value(2.0)).andExpect(jsonPath("$.player.assists").value(1));
        call(get("/api/v1/stats/players/" + sub + "/matches?year=2026&competitionScope=TOURNAMENT"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.player.creditedQuarters").value(0.5)).andExpect(jsonPath("$.player.goals").value(1));
        call(get("/api/v1/stats/players/" + first + "/matches?year=2026&competitionScope=LEAGUE"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.player.creditedQuarters").value(4.0)).andExpect(jsonPath("$.player.goals").value(2));
        // Unlinking a tournament must not silently turn the existing two-half match back into four quarters.
        var unlink = new MatchRequest(cup.playedOn(), cup.kickoff(), "", cup.opponent(), "", 0L, people, halves, List.of(), 4, 2,
                MatchKind.EXTERNAL, RecordingStage.COMPLETED, null, null, null, null, true, null);
        call(put("/api/v1/matches/" + cupId).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(unlink)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.tournamentId").isEmpty()).andExpect(jsonPath("$.matchFormat").value("TWO_HALVES_30"));
    }
    @Test void plannedTeamsRoundTripPreserveOmittedAssignmentsAndRejectCrossTeamPlanWithoutLosingActualStats() throws Exception {
        var base = deletionFixture(null, MatchKind.INTERNAL, 1);
        long id = create(base);
        call(get("/api/v1/matches/" + id)).andExpect(jsonPath("$.participants[0].plannedTeam").value("A"))
                .andExpect(jsonPath("$.participants[1].plannedTeam").value("B"));
        var oldPeople = base.participants().stream().map(p -> new MatchRequest.Participant(p.playerId(), p.vote(), p.attendance())).toList();
        var oldClient = new MatchRequest(base.playedOn(), base.kickoff(), "", "", "기존 요청", 0L, oldPeople, base.quarters(), base.plannedLineup(), 4, 0, MatchKind.INTERNAL);
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(oldClient)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.participants[0].plannedTeam").value("A"));
        var saved = savedMatchRows(id);
        var cross = base.participants().stream().map(p -> new MatchRequest.Participant(p.playerId(), p.vote(), p.attendance(), MatchTeam.A, true)).toList();
        var invalid = new MatchRequest(base.playedOn(), base.kickoff(), "", "", "", 1L, cross, base.quarters(), base.plannedLineup(), 4, 0, MatchKind.INTERNAL);
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest());
        assertThat(savedMatchRows(id)).isEqualTo(saved);
        // Clearing assignments with the plan removed is explicit; the already recorded appearances remain untouched.
        var clearPeople = base.participants().stream().map(p -> new MatchRequest.Participant(p.playerId(), p.vote(), p.attendance(), null, true)).toList();
        var cleared = new MatchRequest(base.playedOn(), base.kickoff(), "", "", "팀 재검토", 1L, clearPeople, base.quarters(), List.of(), 4, 0, MatchKind.INTERNAL);
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(cleared)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.participants[0].plannedTeam").isEmpty());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_participants WHERE match_id=? AND planned_team IS NOT NULL", Integer.class, id)).isZero();
        assertThat(savedMatchRows(id).get("appearances")).isEqualTo(saved.get("appearances"));
        var event = jdbc.queryForMap("SELECT before_snapshot,after_snapshot FROM match_record_events WHERE match_id=? ORDER BY id DESC LIMIT 1", id);
        assertThat(json.readTree(event.get("before_snapshot").toString()).get("participants").get(0).get("plannedTeam").asText()).isEqualTo("A");
        assertThat(json.readTree(event.get("after_snapshot").toString()).get("participants").get(0).get("plannedTeam").isNull()).isTrue();
    }
    @Test void formationRoundTripsAndOmittedUpdatePreservesBothSidesBeforeValidation() throws Exception {
        var base = request(null, List.of(participant(first, Attendance.PRESENT), participant(second, Attendance.PRESENT)),
                List.of(new MatchRequest.Appearance(LineupSlot.LST, first, 1, 0, 0, MatchTeam.A),
                        new MatchRequest.Appearance(LineupSlot.LCDM, second, 0, 0, 0, MatchTeam.B)));
        var input = new MatchRequest(base.playedOn(), base.kickoff(), "", "", "", null,
                base.participants(), base.quarters(), List.of(), 1, 0, MatchKind.INTERNAL, RecordingStage.ACTUAL,
                Formation.F442, Formation.F4231);
        long id = create(input);
        call(get("/api/v1/matches/" + id)).andExpect(jsonPath("$.formationA").value("F442"))
                .andExpect(jsonPath("$.formationB").value("F4231"));
        call(get("/api/v1/matches")).andExpect(jsonPath("$.items[0].formationA").value("F442"));
        var oldClient = new MatchRequest(base.playedOn(), base.kickoff(), "", "", "계획 유지", 0L,
                base.participants(), base.quarters(), List.of(), 1, 0, MatchKind.INTERNAL);
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(oldClient)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.formationA").value("F442"))
                .andExpect(jsonPath("$.formationB").value("F4231")).andExpect(jsonPath("$.version").value(1));
        var saved = savedMatchRows(id);
        var invalid = new MatchRequest(base.playedOn(), base.kickoff(), "", "", "", 1L,
                base.participants(), base.quarters(), List.of(), 1, 0, MatchKind.INTERNAL, null, Formation.F4141, Formation.F4231);
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest());
        assertThat(savedMatchRows(id)).isEqualTo(saved);
        var snapshot = jdbc.queryForObject("SELECT after_snapshot FROM match_record_events WHERE match_id=? ORDER BY id DESC LIMIT 1", String.class, id);
        assertThat(json.readTree(snapshot).get("formationA").asText()).isEqualTo("F442");
        assertThat(json.readTree(snapshot).get("formationB").asText()).isEqualTo("F4231");
    }
    @ParameterizedTest @EnumSource(value = Formation.class, names = {"F352", "F343"})
    void threeBackFormationRoundTripsAndPositionChangesKeepCompletedPlayerStats(Formation formation) throws Exception {
        var playedOn = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Seoul")).minusDays(1);
        var appearances = List.of(new MatchRequest.Appearance(LineupSlot.CCB, first, 2, 0, 0),
                new MatchRequest.Appearance(LineupSlot.CCB, second, 1, 1, 1));
        var base = request(null, List.of(participant(first, Attendance.PRESENT), participant(second, Attendance.LATE)), appearances);
        var plan = List.of(new MatchRequest.PlannedEntry(1, LineupSlot.CCB, 0, first), new MatchRequest.PlannedEntry(1, LineupSlot.CCB, 1, second));
        var input = new MatchRequest(playedOn, base.kickoff(), "", "검증 상대", "", null,
                base.participants(), base.quarters(), plan, 3, 0, MatchKind.EXTERNAL, RecordingStage.COMPLETED, formation, null);
        long id = create(input);
        call(get("/api/v1/matches/" + id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.formationA").value(formation.name())).andExpect(jsonPath("$.formationB").value("F4123"))
                .andExpect(jsonPath("$.participants[0].creditedQuarters").value(0.5))
                .andExpect(jsonPath("$.participants[1].creditedQuarters").value(0.5));
        String statsUrl = "/api/v1/stats/players?year=" + playedOn.getYear();
        var before = json.readTree(call(get(statsUrl)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(before.get("matchCount").asInt()).isEqualTo(1);
        var items = before.get("items");
        assertThat(items.size()).isEqualTo(2);
        assertThat(items.get(0).get("goals").asInt() + items.get(1).get("goals").asInt()).isEqualTo(3);
        assertThat(items.get(0).get("assists").asInt() + items.get(1).get("assists").asInt()).isEqualTo(1);
        assertThat(items.get(0).get("creditedQuarters").asDouble() + items.get(1).get("creditedQuarters").asDouble()).isEqualTo(1);
        var otherFormation = formation == Formation.F352 ? Formation.F343 : Formation.F352;
        var update = new MatchRequest(playedOn, base.kickoff(), "", "검증 상대", "포메이션만 변경", 0L,
                base.participants(), base.quarters(), plan, 3, 0, MatchKind.EXTERNAL, RecordingStage.COMPLETED, otherFormation, null);
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(update)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.formationA").value(otherFormation.name()));
        var after = json.readTree(call(get(statsUrl)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(after).isEqualTo(before);
        var snapshot = jdbc.queryForObject("SELECT after_snapshot FROM match_record_events WHERE match_id=? ORDER BY id DESC LIMIT 1", String.class, id);
        assertThat(json.readTree(snapshot).get("formationA").asText()).isEqualTo(otherFormation.name());
        assertThat(jdbc.queryForObject("SELECT slot FROM match_appearances WHERE match_id=? AND player_id=?", String.class, id, first)).isEqualTo("CCB");
    }
    @ParameterizedTest @EnumSource(MatchKind.class)
    void writingCheckpointRoundTripsWithHistoryAndVersionProtection(MatchKind kind) throws Exception {
        var base = deletionFixture(null, kind, 0);
        long id = create(base);
        call(get("/api/v1/matches/" + id)).andExpect(jsonPath("$.recordingStage").value("ATTENDANCE"));
        long version = 0;
        for (var stage : List.of(RecordingStage.PLAN, RecordingStage.ACTUAL, RecordingStage.RESULT,
                RecordingStage.COMPLETED, RecordingStage.ACTUAL)) {
            var update = new MatchRequest(base.playedOn(), base.kickoff(), base.venue(), base.opponent(), base.notes(), version,
                    base.participants(), base.quarters(), base.plannedLineup(), 0, 0, kind, stage);
            call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(update)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.recordingStage").value(stage.name()));
            version++;
            call(get("/api/v1/matches/" + id)).andExpect(jsonPath("$.recordingStage").value(stage.name()));
            call(get("/api/v1/matches")).andExpect(jsonPath("$.items[0].recordingStage").value(stage.name()));
            assertThat(jdbc.queryForObject("SELECT recording_stage FROM match_records WHERE id=?", String.class, id)).isEqualTo(stage.name());
        }
        var latest = savedMatchRows(id);
        var stale = new MatchRequest(base.playedOn(), base.kickoff(), base.venue(), base.opponent(), "", 0L,
                base.participants(), base.quarters(), base.plannedLineup(), 0, 0, kind, RecordingStage.COMPLETED);
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(stale)))
                .andExpect(status().isConflict());
        assertThat(savedMatchRows(id)).isEqualTo(latest);
        var event = jdbc.queryForMap("SELECT before_snapshot, after_snapshot FROM match_record_events WHERE match_id=? ORDER BY id DESC LIMIT 1", id);
        assertThat(json.readTree(event.get("before_snapshot").toString()).get("recordingStage").asText()).isEqualTo("COMPLETED");
        assertThat(json.readTree(event.get("after_snapshot").toString()).get("recordingStage").asText()).isEqualTo("ACTUAL");
        var invalid = json.writeValueAsString(stale).replace("COMPLETED", "NOT_A_STAGE");
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(invalid)).andExpect(status().isBadRequest());
        assertThat(savedMatchRows(id)).isEqualTo(latest);
    }
    private MatchRequest deletionFixture(Long version, MatchKind kind, int goals) {
        var base = request(version, List.of(participant(first, Attendance.PRESENT), participant(second, Attendance.PRESENT)), List.of());
        var secondTeam = kind == MatchKind.INTERNAL ? MatchTeam.B : MatchTeam.A;
        var secondSlot = kind == MatchKind.INTERNAL ? LineupSlot.ST : LineupSlot.GK;
        var lineup = List.of(new MatchRequest.Appearance(LineupSlot.ST, first, goals, 0, 0, MatchTeam.A),
                new MatchRequest.Appearance(secondSlot, second, 0, 0, 0, secondTeam));
        var quarters = java.util.stream.IntStream.rangeClosed(1, 4).mapToObj(q -> new MatchRequest.Quarter(q, lineup)).toList();
        var plan = quarters.stream().flatMap(q -> q.lineup().stream().map(a ->
                new MatchRequest.PlannedEntry(q.number(), a.slot(), a.entryOrder(), a.playerId(), a.team()))).toList();
        return new MatchRequest(base.playedOn(), base.kickoff(), "검증 구장", "", "삭제 검증", version,
                kind == MatchKind.INTERNAL ? plannedPeople(base.participants(), plan) : base.participants(), quarters, plan, goals * 4, 0, kind);
    }
    private Map<String, Object> savedMatchRows(long id) {
        Map<String, Object> rows = new LinkedHashMap<>();
        rows.put("match", jdbc.queryForMap("SELECT * FROM match_records WHERE id=?", id));
        rows.put("participants", jdbc.queryForList("SELECT * FROM match_participants WHERE match_id=? ORDER BY player_id", id));
        rows.put("quarters", jdbc.queryForList("SELECT * FROM match_quarters WHERE match_id=? ORDER BY quarter_number", id));
        rows.put("appearances", jdbc.queryForList("SELECT * FROM match_appearances WHERE match_id=? ORDER BY quarter_number,team,slot,entry_order", id));
        rows.put("plan", jdbc.queryForList("SELECT * FROM match_planned_lineups WHERE match_id=? ORDER BY quarter_number,team,slot,entry_order", id));
        return rows;
    }
    @ParameterizedTest @EnumSource(MatchKind.class)
    void deletingMatchRemovesAllFourChildCollectionsAndKeepsPlayersAndOtherMatches(MatchKind kind) throws Exception {
        long removed = create(deletionFixture(null, kind, 2));
        long retained = create(deletionFixture(null, kind, 1));
        var otherRows = savedMatchRows(retained);
        var playerRows = jdbc.queryForList("SELECT * FROM players ORDER BY id");
        // 실제 소속 권한을 코치로 바꿔 SecurityFilter의 세션 재검증도 통과해야 한다.
        jdbc.update("UPDATE team_memberships SET role='COACH' WHERE team_id=1 AND account_id=(SELECT id FROM accounts WHERE username='test-admin')");
        call(delete("/api/v1/matches/" + removed + "?version=0").header("X-Team-Id", "1").with(csrf()))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records WHERE id=?", Integer.class, removed)).isZero();
        for (String table : List.of("match_participants", "match_quarters", "match_appearances", "match_planned_lineups"))
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE match_id=?", Integer.class, removed)).as(table).isZero();
        assertThat(savedMatchRows(retained)).isEqualTo(otherRows);
        assertThat(jdbc.queryForList("SELECT * FROM players ORDER BY id")).isEqualTo(playerRows);
        call(get("/api/v1/matches/" + removed)).andExpect(status().isNotFound());
        call(get("/api/v1/matches")).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(retained)).andExpect(jsonPath("$.items[0].scorers[0].goals").value(4));
        call(delete("/api/v1/matches/" + removed + "?version=0").header("X-Team-Id", "1").with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MATCH_NOT_FOUND"));
        assertThat(savedMatchRows(retained)).isEqualTo(otherRows);
    }
    @Test void staleDeletionVersionPreservesTheLatestMatchAndAllChildren() throws Exception {
        long id = create(deletionFixture(null, MatchKind.EXTERNAL, 1));
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(deletionFixture(0L, MatchKind.EXTERNAL, 3))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
        var latest = savedMatchRows(id);
        call(delete("/api/v1/matches/" + id + "?version=0").header("X-Team-Id", "1").with(csrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MATCH_CONFLICT"));
        assertThat(savedMatchRows(id)).isEqualTo(latest);
        call(delete("/api/v1/matches/" + id + "?version=1").header("X-Team-Id", "1").with(csrf()))
                .andExpect(status().isNoContent());
    }
    @Test void internalMatchPersistsBothTeamsAndScoresWithOneAttendanceAndProtectsAgainstInvalidEdits() throws Exception {
        var base = request(null, List.of(participant(first, Attendance.PRESENT), participant(second, Attendance.PRESENT)), List.of());
        var quarters = new ArrayList<>(base.quarters());
        quarters.set(0, new MatchRequest.Quarter(1, List.of(new MatchRequest.Appearance(LineupSlot.ST, first, 2, 0, 0, MatchTeam.A), new MatchRequest.Appearance(LineupSlot.ST, second, 1, 0, 0, MatchTeam.B))));
        quarters.set(1, new MatchRequest.Quarter(2, List.of(new MatchRequest.Appearance(LineupSlot.ST, first, 1, 0, 0, MatchTeam.B))));
        var plan = List.of(new MatchRequest.PlannedEntry(1, LineupSlot.ST, 0, first, MatchTeam.A), new MatchRequest.PlannedEntry(1, LineupSlot.ST, 0, second, MatchTeam.B));
        var internal = new MatchRequest(base.playedOn(), base.kickoff(), "검증 구장", "", "자체전", null, plannedPeople(base.participants(), plan), quarters, plan, 2, 2, MatchKind.INTERNAL);
        long id = create(internal);
        call(get("/api/v1/matches/" + id)).andExpect(jsonPath("$.kind").value("INTERNAL"))
                .andExpect(jsonPath("$.scoreFor").value(2)).andExpect(jsonPath("$.scoreAgainst").value(2))
                .andExpect(jsonPath("$.quarters[0].lineup[0].team").value("A")).andExpect(jsonPath("$.quarters[0].lineup[1].team").value("B"))
                .andExpect(jsonPath("$.plannedLineup[1].team").value("B"))
                .andExpect(jsonPath("$.participants[0].creditedQuarters").value(2)).andExpect(jsonPath("$.participants[1].creditedQuarters").value(1));
        call(get("/api/v1/matches")).andExpect(jsonPath("$.items[0].kind").value("INTERNAL"))
                .andExpect(jsonPath("$.items[0].scorers[0].goals").value(3))
                .andExpect(jsonPath("$.items[0].scorers[0].goalsA").value(2)).andExpect(jsonPath("$.items[0].scorers[0].goalsB").value(1));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_participants WHERE match_id=?", Integer.class, id)).isEqualTo(2);
        // SQL 자체에서도 양 팀의 선수 중복을 막되, 같은 포지션의 양 팀 기록은 허용한다.
        assertThatThrownBy(() -> jdbc.update("INSERT INTO match_appearances(match_id,quarter_number,slot,player_id,goals,assists,team) VALUES (?,1,'GK',?,0,0,'B')", id, first)).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("INSERT INTO match_planned_lineups(match_id,quarter_number,slot,entry_order,player_id,team) VALUES (?,1,'GK',0,?,'B')", id, first)).isInstanceOf(org.springframework.dao.DataAccessException.class);
        var duplicated = new ArrayList<>(quarters);
        duplicated.set(0, new MatchRequest.Quarter(1, List.of(new MatchRequest.Appearance(LineupSlot.ST, first, 2, 0, 0, MatchTeam.A), new MatchRequest.Appearance(LineupSlot.ST, first, 1, 0, 0, MatchTeam.B))));
        var invalid = new MatchRequest(base.playedOn(), base.kickoff(), "", "", "", 0L, base.participants(), duplicated, plan, 3, 2, MatchKind.INTERNAL);
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(invalid))).andExpect(status().isBadRequest());
        var changedKind = new MatchRequest(base.playedOn(), base.kickoff(), "", "", "", 0L, base.participants(), base.quarters(), List.of(), 0, 0, MatchKind.EXTERNAL);
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(changedKind))).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT version FROM match_records WHERE id=?", Long.class, id)).isZero();
        assertThat(jdbc.queryForObject("SELECT SUM(goals) FROM match_appearances WHERE match_id=?", Integer.class, id)).isEqualTo(4);
        var updated = new MatchRequest(base.playedOn(), base.kickoff(), "", "", "수정", 0L, base.participants(), quarters, plan, 3, 2, MatchKind.INTERNAL);
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(updated)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1)).andExpect(jsonPath("$.kind").value("INTERNAL"));
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(updated))).andExpect(status().isConflict());
    }
    @Test void internalMatchAcceptsBothFullTeamsWithSubstitutionsInAllFourQuarters() throws Exception {
        for (int i = 0; i < 42; i++) jdbc.update("INSERT INTO players(team_id,name,position) VALUES (1,?,'FW')", "정원 검증 " + i);
        var ids = jdbc.queryForList("SELECT id FROM players ORDER BY id", Long.class);
        var appearances = new ArrayList<MatchRequest.Appearance>();
        int index = 0;
        for (var team : MatchTeam.values()) for (var slot : Formation.F4123.slots()) for (int order = 0; order <= 1; order++)
            appearances.add(new MatchRequest.Appearance(slot, ids.get(index++), 0, 0, order, team));
        var quarters = java.util.stream.IntStream.rangeClosed(1, 4).mapToObj(q -> new MatchRequest.Quarter(q, appearances)).toList();
        var plan = quarters.stream().flatMap(q -> q.lineup().stream().map(a -> new MatchRequest.PlannedEntry(q.number(), a.slot(), a.entryOrder(), a.playerId(), a.team()))).toList();
        var input = new MatchRequest(java.time.LocalDate.of(2026, 10, 18), java.time.LocalTime.of(11, 0), "", "", "", null,
                plannedPeople(ids.stream().map(id -> participant(id, Attendance.PRESENT)).toList(), plan), quarters, plan, 0, 0, MatchKind.INTERNAL);
        long id = create(input);
        call(get("/api/v1/matches/" + id)).andExpect(jsonPath("$.quarters[0].lineup.length()").value(44))
                .andExpect(jsonPath("$.plannedLineup.length()").value(176)).andExpect(jsonPath("$.participants[0].creditedQuarters").value(2));
    }
    @Test void scoresAndShirtOrderedScorersArePagedWithoutCountingPlansOrDuplicateScorers() throws Exception {
        jdbc.update("UPDATE players SET shirt_number=42 WHERE id=?", first);
        jdbc.update("UPDATE players SET shirt_number=7 WHERE id=?", second);
        jdbc.update("INSERT INTO players(team_id,name,position,shirt_number) VALUES (1,'검증 삼번','FW',3),(1,'검증 구십구번','FW',99),(1,'검증 무번호','FW',NULL)");
        var ids = jdbc.queryForList("SELECT id FROM players ORDER BY id", Long.class);
        var people = ids.stream().map(id -> participant(id, Attendance.PRESENT)).toList();
        var base = request(null, people, List.of(appearance(LineupSlot.ST, first, 1, 0), appearance(LineupSlot.LW, second, 2, 0),
                appearance(LineupSlot.RW, ids.get(2), 1, 0), appearance(LineupSlot.GK, ids.get(3), 4, 0), appearance(LineupSlot.LCM, ids.get(4), 2, 0)));
        var quarters = new ArrayList<>(base.quarters());
        quarters.set(1, new MatchRequest.Quarter(2, List.of(appearance(LineupSlot.ST, first, 5, 0))));
        long id = create(new MatchRequest(base.playedOn(), java.time.LocalTime.of(11, 30), "", "검증 상대", "메모", null,
                people, quarters, List.of(new MatchRequest.PlannedEntry(4, LineupSlot.GK, 0, first)), 20, 2));
        call(get("/api/v1/matches/" + id)).andExpect(jsonPath("$.scoreFor").value(20)).andExpect(jsonPath("$.scoreAgainst").value(2));
        call(get("/api/v1/matches")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].scorerCount").value(5)).andExpect(jsonPath("$.items[0].scorers.length()").value(3))
                .andExpect(jsonPath("$.items[0].scorers[0].shirtNumber").value(3))
                .andExpect(jsonPath("$.items[0].scorers[1].shirtNumber").value(7))
                .andExpect(jsonPath("$.items[0].scorers[2].shirtNumber").value(42))
                .andExpect(jsonPath("$.items[0].scorers[2].goals").value(6));
        for (int i = 0; i < 10; i++) create(request(null, List.of(participant(ids.get(4), Attendance.PRESENT)),
                i == 9 ? List.of(appearance(LineupSlot.ST, ids.get(4), 1, 0)) : List.of()));
        call(get("/api/v1/matches")).andExpect(jsonPath("$.items.length()").value(10))
                .andExpect(jsonPath("$.totalElements").value(11)).andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.items[0].scorers[0].playerId").value(ids.get(4)))
                .andExpect(jsonPath("$.items[0].scorers[0].shirtNumber").isEmpty())
                .andExpect(jsonPath("$.items[0].scoreFor").isEmpty())
                .andExpect(jsonPath("$.items[1].scorerCount").value(0));
        call(get("/api/v1/matches?page=1")).andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(id)).andExpect(jsonPath("$.items[0].scoreFor").value(20));
        var correction = new MatchRequest(base.playedOn(), base.kickoff(), "", "", "", 0L, people, quarters, List.of(), 0, 0);
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(correction)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.scoreFor").value(0)).andExpect(jsonPath("$.version").value(1));
        assertThatThrownBy(() -> jdbc.update("UPDATE match_records SET score_for=NULL WHERE id=?", id)).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE match_records SET score_for=-1 WHERE id=?", id)).isInstanceOf(org.springframework.dao.DataAccessException.class);
    }
    @Test void rejectsMissingOrNonHalfHourTimeAndPartialScoresWithoutWriting() throws Exception {
        var base = request(null, List.of(), List.of());
        for (var time : Arrays.asList(null, java.time.LocalTime.of(11, 15), java.time.LocalTime.of(11, 30, 1))) {
            var input = new MatchRequest(base.playedOn(), time, "", "", "", null, base.participants(), base.quarters());
            call(post("/api/v1/matches").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input))).andExpect(status().isBadRequest());
        }
        var partial = new MatchRequest(base.playedOn(), base.kickoff(), "", "", "", null, base.participants(), base.quarters(), List.of(), 1, null);
        call(post("/api/v1/matches").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(partial))).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records", Integer.class)).isZero();
    }
    @Test void suggestionUsesOnlyEarlierConfirmedAttendanceExcludesEditedMatchAndDoesNotWrite() throws Exception {
        jdbc.update("UPDATE players SET first_choice='CB' WHERE id=?", first);
        jdbc.update("UPDATE players SET first_choice='CB', second_choice='GK' WHERE id=?", second);
        var states = List.of(Attendance.PRESENT, Attendance.LATE, Attendance.ABSENT, Attendance.UNCONFIRMED, Attendance.PRESENT, Attendance.PRESENT);
        var days = List.of("2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-18", "2026-10-19");
        long editedId = 0;
        for (int i = 0; i < states.size(); i++) {
            long id = create(request(null, List.of(participant(first, states.get(i)), participant(second, Attendance.UNCONFIRMED)), List.of()));
            jdbc.update("UPDATE match_records SET played_on=? WHERE id=?", days.get(i), id);
            if (i == 0) editedId = id;
        }
        var input = new LineupSuggestionRequest(java.time.LocalDate.of(2026, 10, 18), List.of(first, second), editedId, 10);
        var response = call(post("/api/v1/matches/lineup-suggestion").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.allocations[0].attended").value(1))
                .andExpect(jsonPath("$.allocations[0].recorded").value(2)).andExpect(jsonPath("$.allocations[1].recorded").value(0))
                .andExpect(jsonPath("$.allocations[1].group").value("GK")).andReturn().getResponse();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records", Long.class)).isEqualTo(6);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_planned_lineups", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT SUM(version) FROM match_records", Long.class)).isZero();
        var suggestion = json.readValue(response.getContentAsString(), LineupSuggestion.class);
        var base = request(null, List.of(participant(first, Attendance.UNCONFIRMED), participant(second, Attendance.UNCONFIRMED)), List.of());
        create(new MatchRequest(base.playedOn(), base.kickoff(), base.venue(), base.opponent(), base.notes(), null,
                base.participants(), base.quarters(), suggestion.plannedLineup()));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_planned_lineups", Long.class)).isEqualTo(8);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_appearances", Long.class)).isZero();
    }
    @Test void guestCanBeSuggestedPlannedAndRecordedWithTheSameIdentity() throws Exception {
        var guestResponse = call(post("/api/v1/players/guests").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"검증 용병\",\"firstChoice\":\"GK\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        long guestId = json.readTree(guestResponse.getContentAsString()).get("id").asLong();
        var input = new LineupSuggestionRequest(java.time.LocalDate.of(2026, 10, 18), List.of(guestId), null, 10);
        var response = call(post("/api/v1/matches/lineup-suggestion").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.allocations[0].group").value("GK")).andReturn().getResponse();
        var plan = json.readValue(response.getContentAsString(), LineupSuggestion.class).plannedLineup();
        assertThat(plan).hasSize(4);
        var base = request(null, List.of(participant(guestId, Attendance.UNCONFIRMED)), List.of());
        long id = create(new MatchRequest(base.playedOn(), base.kickoff(), "", "", "", null, base.participants(), base.quarters(), plan));
        call(get("/api/v1/matches/" + id)).andExpect(jsonPath("$.plannedLineup.length()").value(4))
                .andExpect(jsonPath("$.participants[0].playerType").value("GUEST"))
                .andExpect(jsonPath("$.participants[0].attendance").value("UNCONFIRMED"))
                .andExpect(jsonPath("$.participants[0].creditedQuarters").value(0));
        var quarters = java.util.stream.IntStream.rangeClosed(1, 4).mapToObj(q -> new MatchRequest.Quarter(q,
                List.of(appearance(LineupSlot.GK, guestId, 0, 0)))).toList();
        var actual = new MatchRequest(base.playedOn(), base.kickoff(), "", "", "", 0L,
                List.of(participant(guestId, Attendance.PRESENT)), quarters, plan);
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(actual)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.participants[0].playerId").value(guestId))
                .andExpect(jsonPath("$.participants[0].playerType").value("GUEST"))
                .andExpect(jsonPath("$.participants[0].attendance").value("PRESENT"))
                .andExpect(jsonPath("$.participants[0].creditedQuarters").value(4));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM players WHERE player_type='GUEST'", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_planned_lineups WHERE match_id=?", Integer.class, id)).isEqualTo(4);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_appearances WHERE match_id=?", Integer.class, id)).isEqualTo(4);
    }
    @Test void suggestionRejectsDuplicateMissingAndInactivePlayersWithoutWriting() throws Exception {
        for (var ids : List.of(List.of(first, first), List.of(Long.MAX_VALUE))) {
            var input = new LineupSuggestionRequest(java.time.LocalDate.of(2026, 10, 18), ids, null, 1);
            call(post("/api/v1/matches/lineup-suggestion").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                    .andExpect(status().isBadRequest());
        }
        jdbc.update("UPDATE players SET active=false WHERE id=?", first);
        var input = new LineupSuggestionRequest(java.time.LocalDate.of(2026, 10, 18), List.of(first), null, 1);
        call(post("/api/v1/matches/lineup-suggestion").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                .andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records", Long.class)).isZero();
    }
    @Test void persistsPollAttendanceFourQuartersAndCommentsThenReplacesOnlyChildData() throws Exception {
        var people = List.of(participant(first, Attendance.PRESENT), new MatchRequest.Participant(second, Vote.ABSENT, Attendance.LATE));
        long id = create(request(null, people, List.of(appearance(LineupSlot.ST, first, 1, 0), appearance(LineupSlot.GK, second, 0, 1))));
        call(get("/api/v1/matches/" + id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.quarters.length()").value(4)).andExpect(jsonPath("$.participants[1].vote").value("ABSENT"))
                .andExpect(jsonPath("$.participants[1].attendance").value("LATE")).andExpect(jsonPath("$.notes").value("후반 압박 연습"));
        // 기본 정보가 같고 배치만 바뀌어도 version 증가, 자리 교환 시 UNIQUE 충돌 없음.
        var changed = request(0L, people, List.of(appearance(LineupSlot.GK, first, 0, 0), appearance(LineupSlot.ST, second, 2, 0)));
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(changed)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(changed)))
                .andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("SELECT SUM(goals) FROM match_appearances WHERE match_id=?", Integer.class, id)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT player_id FROM match_appearances WHERE match_id=? AND slot='ST'", Long.class, id)).isEqualTo(second);
        call(get("/api/v1/matches?size=1")).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
    }
    @Test void invalidAttendanceAndUnknownPlayerDoNotPartiallyOverwriteStoredRecords() throws Exception {
        long id = create(request(null, List.of(participant(first, Attendance.PRESENT)), List.of(appearance(LineupSlot.ST, first, 3, 0))));
        var invalid = request(0L, List.of(participant(first, Attendance.ABSENT)), List.of(appearance(LineupSlot.ST, first, 1, 0)));
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(invalid))).andExpect(status().isBadRequest());
        call(post("/api/v1/matches").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(request(null, List.of(participant(Long.MAX_VALUE, Attendance.PRESENT)), List.of())))).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records", Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT version FROM match_records WHERE id=?", Long.class, id)).isZero();
        assertThat(jdbc.queryForObject("SELECT SUM(goals) FROM match_appearances WHERE match_id=?", Integer.class, id)).isEqualTo(3);
    }
    @Test void allowsDraftWithoutAttendanceAndDatabaseRejectsDuplicatePlayerAndInvalidSlot() throws Exception {
        long id = create(request(null, List.of(participant(first, Attendance.UNCONFIRMED)), List.of()));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_quarters WHERE match_id=?", Integer.class, id)).isEqualTo(4);
        jdbc.update("INSERT INTO match_appearances(match_id,quarter_number,slot,player_id,goals,assists) VALUES (?,1,'ST',?,0,0)", id, first);
        assertThatThrownBy(() -> jdbc.update("INSERT INTO match_appearances(match_id,quarter_number,slot,player_id,goals,assists) VALUES (?,1,'LW',?,0,0)", id, first))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("INSERT INTO match_appearances(match_id,quarter_number,slot,player_id,goals,assists) VALUES (?,2,'CF',?,0,0)", id, first))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("DELETE FROM players WHERE id=?", first))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
    }
    @Test void persistsSubstitutionsAndRecalculatesSharesAfterRemovingSubstitute() throws Exception {
        var people = List.of(participant(first, Attendance.PRESENT), participant(second, Attendance.PRESENT));
        long id = create(request(null, people, List.of(appearance(LineupSlot.ST, first, 2, 0), new MatchRequest.Appearance(LineupSlot.ST, second, 1, 1, 1))));
        call(get("/api/v1/matches/" + id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.quarters[0].durationMinutes").doesNotExist())
                .andExpect(jsonPath("$.quarters[0].lineup[1].entryOrder").value(1))
                .andExpect(jsonPath("$.participants[0].creditedQuarters").value(0.5))
                .andExpect(jsonPath("$.participants[1].creditedQuarters").value(0.5));
        var replacement = request(0L, people, List.of(appearance(LineupSlot.ST, first, 2, 0)));
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(replacement)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.participants[0].creditedQuarters").value(1.0))
                .andExpect(jsonPath("$.participants[1].creditedQuarters").value(0.0));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='match_quarters' AND column_name='duration_minutes'", Integer.class)).isZero();
    }

    @Test void plansPersistSeparatelyAndPlanEditsUseTheSameVersionGuard() throws Exception {
        var base = request(null, List.of(participant(first, Attendance.UNCONFIRMED), participant(second, Attendance.UNCONFIRMED)), List.of());
        var plan = List.of(new MatchRequest.PlannedEntry(1, LineupSlot.ST, 0, first), new MatchRequest.PlannedEntry(1, LineupSlot.ST, 1, second));
        var initial = new MatchRequest(base.playedOn(), base.kickoff(), "", "", "", null, base.participants(), base.quarters(), plan);
        long id = create(initial);
        call(get("/api/v1/matches/" + id)).andExpect(jsonPath("$.plannedLineup.length()").value(2))
                .andExpect(jsonPath("$.quarters[0].lineup").isEmpty()).andExpect(jsonPath("$.participants[0].creditedQuarters").value(0))
                .andExpect(jsonPath("$.participants[0].attendance").value("UNCONFIRMED"));
        var swapped = new MatchRequest(base.playedOn(), base.kickoff(), "", "", "", 0L, base.participants(), base.quarters(),
                List.of(new MatchRequest.PlannedEntry(1, LineupSlot.ST, 0, second), new MatchRequest.PlannedEntry(1, LineupSlot.ST, 1, first)));
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(swapped)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
        call(put("/api/v1/matches/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(swapped)))
                .andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("SELECT player_id FROM match_planned_lineups WHERE match_id=? AND entry_order=0", Long.class, id)).isEqualTo(second);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_appearances", Integer.class)).isZero();
        assertThatThrownBy(() -> jdbc.update("INSERT INTO match_planned_lineups(match_id,quarter_number,slot,entry_order,player_id) VALUES (?,1,'GK',0,?)", id, second))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("INSERT INTO match_planned_lineups(match_id,quarter_number,slot,entry_order,player_id) VALUES (?,5,'GK',0,?)", id, second))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
    }
    private org.springframework.test.web.servlet.ResultActions call(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request.with(com.jochookon.team.TeamTestData.accountSession(jdbc)));
    }
}
