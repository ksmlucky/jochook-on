package com.jochookon.match;

import static com.jochookon.match.MatchTestData.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jochookon.player.BulkPlayerRow;
import com.jochookon.player.BulkPlayerService;
import com.jochookon.player.PlayerQueryService;
import com.jochookon.team.TeamContext;
import com.jochookon.team.TeamTestData;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.util.List;
import java.util.function.Supplier;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.mysql.MySQLContainer;
import tools.jackson.databind.ObjectMapper;

@Tag("integration") @Testcontainers
@SpringBootTest(properties = {"spring.datasource.password=unused-test-password",
        "jochookon.bootstrap.admin.username=", "jochookon.bootstrap.admin.password=",
        "jochookon.bootstrap.service-admin-username="})
@AutoConfigureMockMvc @WithMockUser(username = "test-admin", roles = "DIRECTOR")
class TeamIsolationIntegrationTest {
    @Container @ServiceConnection static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired PlayerQueryService playerQueries;
    @Autowired BulkPlayerService bulkPlayers;
    @Autowired MatchService matches;
    @Autowired MatchRepository matchRepository;
    @Autowired MatchWorkbookService workbooks;
    @Autowired LineupSuggestionService suggestions;
    long ownPlayer, ownKeeper, otherPlayer, otherOnlyPlayer;

    @BeforeEach void seedTwoIsolatedClubs() {
        TeamContext.clear();
        TeamTestData.seed(jdbc);
        jdbc.update("DELETE FROM match_record_events");
        jdbc.update("INSERT INTO teams(id,name,description,status) VALUES (2,'별도 검증 클럽','','ACTIVE') ON DUPLICATE KEY UPDATE status='ACTIVE'");
        jdbc.update("DELETE FROM match_planned_lineups");
        jdbc.update("DELETE FROM match_appearances");
        jdbc.update("DELETE FROM match_quarters");
        jdbc.update("DELETE FROM match_participants");
        jdbc.update("DELETE FROM match_records");
        jdbc.update("DELETE FROM players");
        jdbc.update("INSERT INTO players(team_id,name,shirt_number,position,first_choice) VALUES (1,'공통 이름',7,'MF','CM'),(1,'소속 골키퍼',1,'GK','GK'),(2,'공통 이름',7,'MF','CM'),(2,'타팀 전용 선수',8,'FW','ST')");
        jdbc.update("INSERT INTO players(team_id,name,position,player_type) VALUES (2,'타팀 용병','UN','GUEST')");
        ownPlayer = playerId(1, "공통 이름"); ownKeeper = playerId(1, "소속 골키퍼");
        otherPlayer = playerId(2, "공통 이름"); otherOnlyPlayer = playerId(2, "타팀 전용 선수");
    }
    @AfterEach void clearTeamContext() { TeamContext.clear(); }
    private long playerId(long teamId, String name) {
        return jdbc.queryForObject("SELECT id FROM players WHERE team_id=? AND name=?", Long.class, teamId, name);
    }
    private <T> T inTeam(long teamId, Supplier<T> action) {
        TeamContext.set(teamId);
        try { return action.get(); } finally { TeamContext.clear(); }
    }

    @Test void playerPagesAndShirtUniquenessAreScopedToTheClub() throws Exception {
        mvc.perform(get("/api/v1/players?size=1&sort=shirtNumber").header("X-Team-Id", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2)).andExpect(jsonPath("$.items[0].id").value(ownKeeper));
        mvc.perform(get("/api/v1/players/guests").header("X-Team-Id", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        assertThat(inTeam(2, () -> playerQueries.findActivePlayers(0, 20, "shirtNumber", "asc")).items())
                .extracting(p -> p.id()).containsExactly(otherPlayer, otherOnlyPlayer);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM players WHERE shirt_number=7", Integer.class)).isEqualTo(2);
        assertThatThrownBy(() -> jdbc.update("INSERT INTO players(team_id,name,shirt_number,position) VALUES (1,'같은 팀 중복',7,'UN')"))
                .isInstanceOf(DataAccessException.class);
        mvc.perform(post("/api/v1/players").header("X-Team-Id", "1").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"다른 팀 번호 허용\",\"position\":\"UN\",\"shirtNumber\":8}"))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/players").header("X-Team-Id", "1").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"같은 팀 번호 거부\",\"position\":\"UN\",\"shirtNumber\":8}"))
                .andExpect(status().isBadRequest());
    }

    @Test void foreignPlayerIdsCannotBeReadOrUpdatedAndExpectedTeamIsMandatory() throws Exception {
        mvc.perform(get("/api/v1/players/" + otherPlayer).header("X-Team-Id", "1"))
                .andExpect(status().isNotFound());
        mvc.perform(put("/api/v1/players/" + otherPlayer).header("X-Team-Id", "1").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"허용되면 안 됨\",\"position\":\"UN\",\"version\":0}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/players").header("X-Team-Id", "2"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_CHANGED"));
        mvc.perform(get("/api/v1/players")).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("SELECT name FROM players WHERE id=?", String.class, otherPlayer)).isEqualTo("공통 이름");
        assertThat(jdbc.queryForObject("SELECT version FROM players WHERE id=?", Long.class, otherPlayer)).isZero();
    }

    @Test void matchIdsAndEveryParticipantLinkStayWithinTheCurrentClub() throws Exception {
        var own = inTeam(1, () -> matches.create(request(null, List.of(participant(ownPlayer, Attendance.PRESENT)), List.of())));
        var other = inTeam(2, () -> matches.create(request(null, List.of(participant(otherPlayer, Attendance.PRESENT)), List.of())));
        mvc.perform(get("/api/v1/matches/" + other.id()).header("X-Team-Id", "1")).andExpect(status().isNotFound());
        var foreignUpdate = request(0L, List.of(participant(otherPlayer, Attendance.PRESENT)), List.of());
        mvc.perform(put("/api/v1/matches/" + other.id()).header("X-Team-Id", "1").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(foreignUpdate))).andExpect(status().isNotFound());

        var foreignParticipants = List.of(participant(ownPlayer, Attendance.PRESENT), participant(otherPlayer, Attendance.PRESENT));
        var foreignActual = request(null, foreignParticipants, List.of(appearance(LineupSlot.ST, otherPlayer, 1, 0)));
        var foreignPlan = new MatchRequest(foreignActual.playedOn(), foreignActual.kickoff(), "", "", "", null,
                foreignParticipants, request(null, foreignParticipants, List.of()).quarters(),
                List.of(new MatchRequest.PlannedEntry(1, LineupSlot.ST, 0, otherPlayer)));
        for (var invalid : List.of(request(null, foreignParticipants, List.of()), foreignActual, foreignPlan)) {
            mvc.perform(post("/api/v1/matches").header("X-Team-Id", "1").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(invalid))).andExpect(status().isBadRequest());
        }
        mvc.perform(put("/api/v1/matches/" + own.id()).header("X-Team-Id", "1").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(foreignUpdate))).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records", Long.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT version FROM match_records WHERE id=?", Long.class, own.id())).isZero();
        assertThat(jdbc.queryForList("SELECT player_id FROM match_participants WHERE match_id=?", Long.class, own.id())).containsExactly(ownPlayer);
    }

    @Test void scoreAndAttendanceQueriesAndAutomaticLineupsDoNotMixClubs() throws Exception {
        var own = inTeam(1, () -> matches.create(request(null, List.of(participant(ownPlayer, Attendance.PRESENT)),
                List.of(appearance(LineupSlot.ST, ownPlayer, 2, 0)))));
        var other = inTeam(2, () -> matches.create(request(null, List.of(participant(otherPlayer, Attendance.PRESENT)),
                List.of(appearance(LineupSlot.ST, otherPlayer, 9, 0)))));
        jdbc.update("UPDATE match_records SET played_on='2026-10-11'");
        mvc.perform(get("/api/v1/matches").header("X-Team-Id", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(own.id()))
                .andExpect(jsonPath("$.items[0].scorers[0].playerId").value(ownPlayer))
                .andExpect(jsonPath("$.items[0].scorers[0].goals").value(2));
        assertThat(matchRepository.goalScorers(1, List.of(own.id(), other.id())))
                .extracting(MatchRepository.GoalScorer::getPlayerId).containsExactly(ownPlayer);
        var history = matchRepository.attendanceHistory(1, LocalDate.of(2026, 10, 18), null, List.of(ownPlayer, otherPlayer),
                List.of(Attendance.PRESENT, Attendance.LATE), List.of(Attendance.PRESENT, Attendance.LATE, Attendance.ABSENT));
        assertThat(history).extracting(MatchRepository.AttendanceHistory::getPlayerId).containsExactly(ownPlayer);
        assertThat(history.getFirst().getRecorded()).isEqualTo(1);
        var input = new LineupSuggestionRequest(LocalDate.of(2026, 10, 18), List.of(ownPlayer, ownKeeper), null, 0);
        var lineup = inTeam(1, () -> suggestions.suggest(input));
        assertThat(lineup.allocations()).extracting(LineupSuggestion.Allocation::playerId).containsExactlyInAnyOrder(ownPlayer, ownKeeper);
        assertThat(lineup.allocations().stream().filter(a -> a.playerId() == ownPlayer).findFirst().orElseThrow().recorded()).isEqualTo(1);
        assertThatThrownBy(() -> inTeam(1, () -> suggestions.suggest(new LineupSuggestionRequest(input.playedOn(), List.of(ownPlayer, otherPlayer), null, 0))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> inTeam(1, () -> suggestions.suggest(new LineupSuggestionRequest(input.playedOn(), List.of(ownPlayer), other.id(), 0))))
                .isInstanceOf(MatchNotFoundException.class);
    }

    @Test void foreignMatchCannotBeDeletedAndItsRecordsSurviveOwnTeamDeletion() throws Exception {
        var own = inTeam(1, () -> matches.create(request(null, List.of(participant(ownPlayer, Attendance.PRESENT)),
                List.of(appearance(LineupSlot.ST, ownPlayer, 2, 0)))));
        var otherBase = request(null, List.of(participant(otherPlayer, Attendance.PRESENT)), List.of(appearance(LineupSlot.ST, otherPlayer, 9, 0)));
        var otherInput = new MatchRequest(otherBase.playedOn(), otherBase.kickoff(), "검증 구장", "별도 상대", "보존 확인", null,
                otherBase.participants(), otherBase.quarters(), List.of(new MatchRequest.PlannedEntry(1, LineupSlot.ST, 0, otherPlayer)));
        var other = inTeam(2, () -> matches.create(otherInput));
        long otherEvent = jdbc.queryForObject("SELECT id FROM match_record_events WHERE match_id=?", Long.class, other.id());
        mvc.perform(get("/api/v1/matches/history/" + otherEvent).header("X-Team-Id", "1"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MATCH_HISTORY_NOT_FOUND"));
        mvc.perform(get("/api/v1/matches/history?matchId=" + other.id()).header("X-Team-Id", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(delete("/api/v1/matches/" + other.id() + "?version=0").header("X-Team-Id", "1").with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MATCH_NOT_FOUND"));
        assertThat(inTeam(2, () -> matches.get(other.id()))).isEqualTo(other);
        mvc.perform(delete("/api/v1/matches/" + own.id() + "?version=0").header("X-Team-Id", "2").with(csrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_CHANGED"));
        mvc.perform(delete("/api/v1/matches/" + own.id() + "?version=0").header("X-Team-Id", "1").with(csrf()))
                .andExpect(status().isNoContent());
        assertThat(inTeam(2, () -> matches.get(other.id()))).isEqualTo(other);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM players", Long.class)).isEqualTo(5);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records", Long.class)).isEqualTo(1);
        mvc.perform(get("/api/v1/matches/history").header("X-Team-Id", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.items[0].action").value("DELETED"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_record_events WHERE team_id=2", Long.class)).isEqualTo(1);
    }

    @Test void workbookNamesIdsAndBulkCollisionChecksUseOnlyTheCurrentClub() throws Exception {
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(workbooks.template()))) {
            var row = book.getSheet("쿼터기록").getRow(1);
            row.getCell(3, Row.MissingCellPolicy.CREATE_NULL_AS_BLANK).setCellValue("공통 이름");
            row.getCell(4, Row.MissingCellPolicy.CREATE_NULL_AS_BLANK).setCellValue("7");
            var ownPreview = inTeam(1, () -> workbooks.preview(upload(book)));
            assertThat(ownPreview.isValid()).isTrue();
            assertThat(ownPreview.rows().getFirst().playerId()).isEqualTo(ownPlayer);
            row.getCell(7, Row.MissingCellPolicy.CREATE_NULL_AS_BLANK).setCellValue(String.valueOf(otherPlayer));
            var foreignId = inTeam(1, () -> workbooks.preview(upload(book)));
            assertThat(foreignId.isValid()).isFalse();
            assertThat(foreignId.rows().getFirst().playerId()).isNull();
            row.getCell(3).setCellValue("타팀 전용 선수");
            row.getCell(4).setCellValue("8");
            row.getCell(7).setBlank();
            assertThat(inTeam(1, () -> workbooks.preview(upload(book))).isValid()).isFalse();
        }
        var row = new BulkPlayerRow("타팀 전용 선수", "FW", "8", "", "ST", "", "", "", "");
        var preview = inTeam(1, () -> bulkPlayers.preview(List.of(row), null));
        assertThat(preview.isValid()).isTrue();
        assertThat(preview.rows().getFirst().warnings()).isEmpty();
        var created = inTeam(1, () -> bulkPlayers.create(List.of(row)));
        assertThat(created).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT team_id FROM players WHERE id=?", Long.class, created.getFirst().id())).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM players WHERE shirt_number=8", Long.class)).isEqualTo(2);
    }

    private MockMultipartFile upload(XSSFWorkbook book) {
        try {
            var output = new ByteArrayOutputStream(); book.write(output);
            return new MockMultipartFile("file", "team-match.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", output.toByteArray());
        } catch (java.io.IOException exception) { throw new java.io.UncheckedIOException(exception); }
    }
}
