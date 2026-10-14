package com.jochookon.match;

import static com.jochookon.match.MatchTestData.*;
import static org.assertj.core.api.Assertions.*;
import static com.jochookon.player.TeamScopedRequests.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jochookon.team.TeamContext;
import java.time.Instant;
import java.util.List;
import java.util.function.Supplier;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.mysql.MySQLContainer;
import tools.jackson.databind.ObjectMapper;

@Tag("integration") @Testcontainers
@SpringBootTest(properties = {"spring.datasource.password=unused-test-password", "jochookon.bootstrap.admin.username=",
        "jochookon.bootstrap.admin.password=", "jochookon.bootstrap.service-admin-username="})
@AutoConfigureMockMvc @WithMockUser(username = "test-admin", roles = "DIRECTOR")
class MatchHistoryIntegrationTest {
    @Container @ServiceConnection static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired MatchService matches;
    @Autowired MatchHistoryService history;
    long player;

    @BeforeEach void seed() {
        TeamContext.clear();
        com.jochookon.team.TeamTestData.seed(jdbc);
        for (String table : List.of("match_record_events", "match_planned_lineups", "match_appearances", "match_quarters", "match_participants", "match_records", "players"))
            jdbc.update("DELETE FROM " + table);
        jdbc.update("INSERT INTO players(team_id,name,position,first_choice,shirt_number) VALUES (1,'이력 검증 선수','FW','ST',8)");
        player = jdbc.queryForObject("SELECT id FROM players", Long.class);
    }
    @AfterEach void clearScope() { TeamContext.clear(); }
    private <T> T inTeam(Supplier<T> action) {
        TeamContext.set(1);
        try { return action.get(); } finally { TeamContext.clear(); }
    }
    private MatchRequest input(Long version, String notes, int goals) {
        var base = request(version, List.of(participant(player, Attendance.PRESENT)), List.of(appearance(LineupSlot.ST, player, goals, 0)));
        return new MatchRequest(base.playedOn(), base.kickoff(), "이력 구장", "이력 상대", notes, version,
                base.participants(), base.quarters(), List.of(new MatchRequest.PlannedEntry(1, LineupSlot.ST, 0, player)), goals, 0);
    }
    private long eventId(long matchId, String action) {
        return jdbc.queryForObject("SELECT id FROM match_record_events WHERE match_id=? AND action=?", Long.class, matchId, action);
    }
    private MatchHistory.Detail detail(long id) { return inTeam(() -> history.get(id)); }

    @Test void creationUpdateAndDeletionRecordTrustedActorCompleteSnapshotsAndRemainReadableAfterDeletion() throws Exception {
        Instant started = Instant.now().minusSeconds(1);
        var initial = inTeam(() -> matches.create(input(null, "최초 코멘트", 1)));
        long createdId = eventId(initial.id(), "CREATED");
        var created = detail(createdId);
        assertThat(created.before()).isNull();
        assertThat(created.after()).isEqualTo(initial);
        assertThat(created.actorUsername()).isEqualTo("test-admin");
        assertThat(created.occurredAt()).isBetween(started, Instant.now().plusSeconds(1));
        assertThat(jdbc.queryForObject("SELECT actor_account_id FROM match_record_events WHERE id=?", Long.class, createdId))
                .isEqualTo(jdbc.queryForObject("SELECT id FROM accounts WHERE username='test-admin'", Long.class));

        var updated = inTeam(() -> matches.update(initial.id(), input(0L, "바뀐 코멘트", 3)));
        var change = detail(eventId(initial.id(), "UPDATED"));
        assertThat(change.before()).isEqualTo(initial);
        assertThat(change.after()).isEqualTo(updated);
        assertThat(change.beforeVersion()).isZero();
        assertThat(change.afterVersion()).isEqualTo(1);
        // Snapshots keep the name/number at the time of the action, not a live join to players.
        jdbc.update("UPDATE players SET name='이후 변경된 선수', shirt_number=9 WHERE id=?", player);
        assertThat(detail(createdId).after().participants().getFirst().name()).isEqualTo("이력 검증 선수");

        mvc.perform(delete("/api/v1/matches/" + initial.id() + "?version=1").header("X-Team-Id", "1").with(csrf()))
                .andExpect(status().isNoContent());
        long deletedId = eventId(initial.id(), "DELETED");
        var removed = detail(deletedId);
        assertThat(removed.before().version()).isEqualTo(1);
        assertThat(removed.before().notes()).isEqualTo("바뀐 코멘트");
        assertThat(removed.before().plannedLineup()).hasSize(1);
        assertThat(removed.before().quarters().getFirst().lineup().getFirst().goals()).isEqualTo(3);
        assertThat(removed.after()).isNull();
        assertThat(removed.afterVersion()).isNull();
        mvc.perform(get("/api/v1/matches/" + initial.id())).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/matches/history?matchId=" + initial.id() + "&size=2"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.totalElements").value(3)).andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.items[0].action").value("DELETED")).andExpect(jsonPath("$.items[1].action").value("UPDATED"))
                .andExpect(jsonPath("$.items[0].before").doesNotExist());
        mvc.perform(get("/api/v1/matches/history?matchId=" + initial.id() + "&size=2&page=1"))
                .andExpect(jsonPath("$.items[0].action").value("CREATED"));
        mvc.perform(get("/api/v1/matches/history/" + deletedId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.before.notes").value("바뀐 코멘트")).andExpect(jsonPath("$.after").isEmpty())
                .andExpect(jsonPath("$.actorUsername").value("test-admin"));
        // An old account's later rename does not rewrite actor identity in historical events.
        jdbc.update("UPDATE accounts SET username='renamed-test-admin' WHERE username='test-admin'");
        assertThat(detail(createdId).actorUsername()).isEqualTo("test-admin");
    }

    @Test void rejectedOrStaleMutationsDoNotAppendHistory() throws Exception {
        var saved = inTeam(() -> matches.create(input(null, "기록", 1)));
        inTeam(() -> matches.update(saved.id(), input(0L, "수정", 2)));
        long count = jdbc.queryForObject("SELECT COUNT(*) FROM match_record_events", Long.class);
        mvc.perform(put("/api/v1/matches/" + saved.id()).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(input(0L, "오래된 수정", 4)))).andExpect(status().isConflict());
        mvc.perform(delete("/api/v1/matches/" + saved.id() + "?version=0").header("X-Team-Id", "1").with(csrf()))
                .andExpect(status().isConflict());
        mvc.perform(delete("/api/v1/matches/999999?version=0").header("X-Team-Id", "1").with(csrf()))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/matches").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_record_events", Long.class)).isEqualTo(count);
        assertThat(inTeam(() -> matches.get(saved.id())).notes()).isEqualTo("수정");
    }

    @Test void auditInsertFailureRollsBackCreateUpdateAndDeletionIncludingChildren() {
        var saved = inTeam(() -> matches.create(input(null, "롤백할 원본", 2)));
        // Use a temporary CHECK in this disposable schema, without requiring
        // MySQL's extra binary-log/SUPER privileges for CREATE TRIGGER.
        jdbc.execute("""
                ALTER TABLE match_record_events ADD CONSTRAINT reject_test_history
                CHECK (action='CREATED' AND JSON_UNQUOTE(JSON_EXTRACT(after_snapshot, '$.notes'))='롤백할 원본')
                """);
        try {
            assertThatThrownBy(() -> inTeam(() -> matches.create(input(null, "실패할 생성", 1)))).isInstanceOf(DataAccessException.class);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records", Long.class)).isEqualTo(1);
            assertThatThrownBy(() -> inTeam(() -> matches.update(saved.id(), input(0L, "실패할 수정", 3)))).isInstanceOf(DataAccessException.class);
            assertThat(inTeam(() -> matches.get(saved.id()))).isEqualTo(saved);
            assertThatThrownBy(() -> inTeam(() -> { matches.delete(saved.id(), 0); return null; })).isInstanceOf(DataAccessException.class);
            assertThat(inTeam(() -> matches.get(saved.id()))).isEqualTo(saved);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_record_events", Long.class)).isEqualTo(1);
        } finally { jdbc.execute("ALTER TABLE match_record_events DROP CHECK reject_test_history"); }
    }

    @Test void firstChangeOfExistingMatchCapturesBeforeStateWithoutInventingEarlierEvents() {
        jdbc.update("INSERT INTO match_records(team_id,played_on,kickoff,venue,opponent,notes,version) VALUES (1,'2026-10-18','07:00:00','이전 구장','이전 상대','이전 코멘트',7)");
        long existing = jdbc.queryForObject("SELECT id FROM match_records", Long.class);
        for (int quarter = 1; quarter <= 4; quarter++) jdbc.update("INSERT INTO match_quarters(match_id,quarter_number) VALUES (?,?)", existing, quarter);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_record_events", Long.class)).isZero();
        var before = inTeam(() -> matches.get(existing));
        var after = inTeam(() -> matches.update(existing, input(7L, "이력 도입 후 수정", 2)));
        var recorded = detail(eventId(existing, "UPDATED"));
        assertThat(recorded.before()).isEqualTo(before);
        assertThat(recorded.after()).isEqualTo(after);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_record_events", Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_record_events WHERE action='CREATED'", Long.class)).isZero();
    }
}
