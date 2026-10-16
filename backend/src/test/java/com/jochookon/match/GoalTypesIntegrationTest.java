package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
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
class GoalTypesIntegrationTest {
    @Container @ServiceConnection static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Autowired JdbcTemplate jdbc;
    @Autowired MatchService matches;
    @Autowired MatchSaveService saves;
    @Autowired MatchWorkbookService workbook;
    @Autowired PlayerStatsService stats;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    final LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
    @BeforeEach void seed() {
        TeamTestData.seed(jdbc);
        for (String table : List.of("match_save_requests", "match_record_events", "match_planned_lineups", "match_appearances", "match_quarters", "match_participants", "match_records", "tournaments", "players")) jdbc.update("DELETE FROM " + table);
        jdbc.update("INSERT INTO players(id,team_id,name,shirt_number,position,first_choice,active,player_type) VALUES (1,1,'FK 검증 선수',7,'FW','ST',1,'MEMBER'),(2,1,'PK 검증 용병',NULL,'FW','ST',1,'GUEST')");
    }
    @AfterEach void clear() { TeamContext.clear(); SecurityContextHolder.clearContext(); }
    private <T> T scoped(Supplier<T> work) {
        TeamContext.set(1);
        SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated("test-admin", null, AuthorityUtils.createAuthorityList("ROLE_DIRECTOR")));
        try { return work.get(); } finally { clear(); }
    }
    private MatchRequest input(Long version, int goals, Integer fk, Integer pk) {
        return new MatchRequest(today, LocalTime.of(11, 0), "", "가상 상대", "", version,
                List.of(MatchTestData.participant(1, Attendance.PRESENT)),
                List.of(new MatchRequest.Quarter(1, List.of(new MatchRequest.Appearance(LineupSlot.ST, 1L, goals, 0, 0, MatchTeam.A, fk, pk))),
                new MatchRequest.Quarter(2, List.of()), new MatchRequest.Quarter(3, List.of()), new MatchRequest.Quarter(4, List.of())),
                List.of(), null, null, MatchKind.EXTERNAL, RecordingStage.COMPLETED);
    }
    @Test void httpSaveReadOldUpdatePreservationExplicitResetAndSubsetFailureAreAtomic() throws Exception {
        String created = call(post("/api/v1/matches").header("X-Team-Id", 1).with(user("test-admin").roles("DIRECTOR")).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input(null, 3, 1, 2))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.quarters[0].lineup[0].freeKickGoals").value(1))
                .andExpect(jsonPath("$.quarters[0].lineup[0].penaltyGoals").value(2)).andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();
        var kept = scoped(() -> matches.update(id, input(0L, 3, null, null)));
        assertThat(kept.quarters().getFirst().lineup().getFirst().penaltyGoals()).isEqualTo(2);
        UUID key = UUID.randomUUID();
        call(put("/api/v1/matches/" + id).header("X-Team-Id", 1).header("Idempotency-Key", key)
                        .with(user("test-admin").roles("DIRECTOR")).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(input(kept.version(), 2, null, null))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        assertThat(scoped(() -> matches.get(id)).version()).isEqualTo(kept.version());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_save_requests", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_record_events", Long.class)).isEqualTo(2);
        var reset = scoped(() -> matches.update(id, input(kept.version(), 0, 0, 0)));
        assertThat(reset.quarters().getFirst().lineup().getFirst().freeKickGoals()).isZero();
        String snapshot = jdbc.queryForObject("SELECT before_snapshot FROM match_record_events WHERE match_id=? ORDER BY id DESC LIMIT 1", String.class, id);
        assertThat(json.readTree(snapshot).get("quarters").get(0).get("lineup").get(0).get("penaltyGoals").asInt()).isEqualTo(2);
        call(get("/api/v1/matches/" + id).header("X-Team-Id", 1).with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.quarters[0].lineup[0].penaltyGoals").value(0));
    }
    @Test void changedTypesCannotReplayReceiptButIdenticalOldAndNewRequestsDo() {
        UUID oldKey = UUID.randomUUID(), newKey = UUID.randomUUID();
        var old = scoped(() -> saves.save(oldKey, null, input(null, 3, null, null)));
        assertThat(scoped(() -> saves.save(oldKey, null, input(null, 3, null, null))).id()).isEqualTo(old.id());
        var typed = scoped(() -> saves.save(newKey, null, input(null, 3, 1, 2)));
        assertThat(scoped(() -> saves.save(newKey, null, input(null, 3, 1, 2))).id()).isEqualTo(typed.id());
        assertThatThrownBy(() -> scoped(() -> saves.save(newKey, null, input(null, 3, 2, 1))))
                .isInstanceOfSatisfying(TeamAccessException.class, e -> assertThat(e.code()).isEqualTo("REQUEST_CHANGED"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_record_events", Long.class)).isEqualTo(2);
    }
    @Test void legacyWorkbookPreviewAndSaveKeepExistingTypesWhileNewZerosReset() throws Exception {
        var saved = scoped(() -> matches.create(input(null, 3, 1, 2)));
        try (var book = new org.apache.poi.xssf.usermodel.XSSFWorkbook(new java.io.ByteArrayInputStream(workbook.template()))) {
            var header = book.getSheet("쿼터기록").getRow(0);
            header.removeCell(header.getCell(8)); header.removeCell(header.getCell(9));
            var row = book.getSheet("쿼터기록").getRow(1);
            row.createCell(3).setCellValue("FK 검증 선수"); row.createCell(5).setCellValue(3);
            var bytes = new java.io.ByteArrayOutputStream(); book.write(bytes);
            var file = new org.springframework.mock.web.MockMultipartFile("file", "old.xlsx", "", bytes.toByteArray());
            var preview = scoped(() -> workbook.preview(file));
            assertThat(preview.quarters().getFirst().lineup().getFirst().freeKickGoals()).isNull();
            var b = input(saved.version(), 3, null, null);
            var applied = new MatchRequest(b.playedOn(), b.kickoff(), b.venue(), b.opponent(), b.notes(), b.version(), b.participants(), preview.quarters());
            var updated = scoped(() -> matches.update(saved.id(), applied));
            assertThat(updated.quarters().getFirst().lineup().getFirst().freeKickGoals()).isEqualTo(1);
            assertThat(updated.quarters().getFirst().lineup().getFirst().penaltyGoals()).isEqualTo(2);
        }
    }
    @Test void seasonDetailAndScorersSumTypesWithTheSameFiltersAndHalfQuarterCredit() {
        jdbc.update("INSERT INTO tournaments(id,team_id,name,start_date,end_date) VALUES (1,1,'가상 세부득점 대회',?,?)", today, today);
        var base = input(null, 3, 1, 1);
        var quarters = new ArrayList<>(base.quarters());
        quarters.set(0, new MatchRequest.Quarter(1, List.of(base.quarters().getFirst().lineup().getFirst(),
                new MatchRequest.Appearance(LineupSlot.ST, 2L, 1, 0, 1, MatchTeam.A, 0, 1))));
        var leagueInput = new MatchRequest(today, base.kickoff(), "", "가상 상대", "", null,
                List.of(MatchTestData.participant(1, Attendance.PRESENT), MatchTestData.participant(2, Attendance.PRESENT)),
                quarters, List.of(), null, null, MatchKind.EXTERNAL, RecordingStage.COMPLETED);
        var league = scoped(() -> matches.create(leagueInput));
        var cupBase = input(null, 4, 2, 1);
        var cupInput = new MatchRequest(today, base.kickoff(), "", "가상 상대", "", null, cupBase.participants(), cupBase.quarters(), List.of(), null, null,
                MatchKind.EXTERNAL, RecordingStage.COMPLETED, Formation.F4123, Formation.F4123, 1L, TournamentStage.GROUP, true);
        scoped(() -> matches.create(cupInput));
        for (var scope : CompetitionScope.values()) {
            var season = scoped(() -> stats.list(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, null, scope));
            var detail = scoped(() -> stats.matches(1, today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0, null, scope));
            assertThat(detail.player()).isEqualTo(season.items().getFirst());
            assertThat(detail.items().stream().mapToLong(PlayerMatchStatsResponse.Item::freeKickGoals).sum()).isEqualTo(detail.player().freeKickGoals());
            assertThat(detail.items().stream().mapToLong(PlayerMatchStatsResponse.Item::penaltyGoals).sum()).isEqualTo(detail.player().penaltyGoals());
            if (scope == CompetitionScope.ALL) {
                assertThat(detail.player().goals()).isEqualTo(7); assertThat(detail.player().freeKickGoals()).isEqualTo(3);
                assertThat(detail.player().penaltyGoals()).isEqualTo(2); assertThat(detail.player().creditedQuarters()).isEqualTo(1.5);
            }
            if (scope == CompetitionScope.LEAGUE) assertThat(detail.player().creditedQuarters()).isEqualTo(0.5);
        }
        var guest = scoped(() -> stats.matches(2, today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, true, 0, null, CompetitionScope.LEAGUE));
        assertThat(guest.player().penaltyGoals()).isEqualTo(1); assertThat(guest.player().creditedQuarters()).isEqualTo(0.5);
        assertThat(scoped(() -> matches.list(0, 10)).items()).filteredOn(m -> m.id().equals(league.id())).singleElement()
                .satisfies(m -> assertThat(m.scorers()).filteredOn(s -> s.playerId() == 1).singleElement()
                        .satisfies(s -> { assertThat(s.goals()).isEqualTo(3); assertThat(s.freeKickGoals()).isEqualTo(1); assertThat(s.penaltyGoals()).isEqualTo(1); }));
        var specific = scoped(() -> stats.list(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 1L, CompetitionScope.TOURNAMENT));
        assertThat(specific.items().getFirst().freeKickGoals()).isEqualTo(2);
        assertThat(specific.items().getFirst().penaltyGoals()).isEqualTo(1);
    }
    private org.springframework.test.web.servlet.ResultActions call(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request.with(com.jochookon.team.TeamTestData.accountSession(jdbc)));
    }
}
