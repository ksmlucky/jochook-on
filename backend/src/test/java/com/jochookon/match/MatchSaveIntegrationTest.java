package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import com.jochookon.team.TeamAccessException;
import com.jochookon.team.TeamContext;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.mysql.MySQLContainer;

@Tag("integration") @Testcontainers
@SpringBootTest(properties = {"spring.datasource.password=unused-test-password", "jochookon.bootstrap.admin.username=",
        "jochookon.bootstrap.admin.password=", "jochookon.bootstrap.service-admin-username="})
class MatchSaveIntegrationTest {
    @Container @ServiceConnection static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Autowired JdbcTemplate jdbc;
    @Autowired MatchSaveService saves;
    @Autowired MatchService matches;

    @BeforeEach void seed() {
        com.jochookon.team.TeamTestData.seed(jdbc);
        for (String table : List.of("match_save_requests", "match_record_events", "match_planned_lineups", "match_appearances",
                "match_quarters", "match_participants", "match_records", "players")) jdbc.update("DELETE FROM " + table);
    }
    @AfterEach void clear() { TeamContext.clear(); SecurityContextHolder.clearContext(); }

    private <T> T scoped(long team, String account, Supplier<T> action) {
        TeamContext.set(team);
        SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(account, null,
                AuthorityUtils.createAuthorityList("ROLE_DIRECTOR")));
        try { return action.get(); } finally { TeamContext.clear(); SecurityContextHolder.clearContext(); }
    }
    private <T> T scoped(Supplier<T> action) { return scoped(1, "test-admin", action); }
    private MatchRequest input(Long version, String notes) {
        var base = MatchTestData.request(version, List.of(), List.of());
        return new MatchRequest(base.playedOn(), base.kickoff(), base.venue(), base.opponent(), notes, version,
                base.participants(), base.quarters(), List.of(), null, null, base.kind(), RecordingStage.ATTENDANCE, Formation.F4123, Formation.F4123);
    }
    private long count(String table) { return jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Long.class); }
    private void expectCode(String code, Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(TeamAccessException.class, error -> assertThat(error.code()).isEqualTo(code));
    }

    @Test void createAndUpdateReplayOnceWithOneHistoryEventAndSavedVersion() {
        UUID createKey = UUID.randomUUID(), updateKey = UUID.randomUUID();
        var created = scoped(() -> saves.save(createKey, null, input(null, "최초")));
        assertThat(scoped(() -> saves.save(createKey, null, input(null, "최초")))).isEqualTo(created);
        assertThat(count("match_records")).isEqualTo(1);
        assertThat(count("match_record_events")).isEqualTo(1);
        var changed = scoped(() -> saves.save(updateKey, created.id(), input(created.version(), "수정")));
        assertThat(scoped(() -> saves.save(updateKey, created.id(), input(created.version(), "수정")))).isEqualTo(changed);
        assertThat(changed.version()).isEqualTo(created.version() + 1);
        assertThat(count("match_record_events")).isEqualTo(2);
        assertThat(scoped(() -> saves.status(updateKey))).isEqualTo(new MatchSaveService.Status(created.id(), changed.version(), true));
    }

    @Test void oneKeyCannotChangePayloadMethodOrTargetAndReceiptsSurviveLaterChangeAndDeletion() {
        UUID createKey = UUID.randomUUID(), updateKey = UUID.randomUUID();
        var created = scoped(() -> saves.save(createKey, null, input(null, "원본")));
        expectCode("REQUEST_CHANGED", () -> scoped(() -> saves.save(createKey, null, input(null, "다른 내용"))));
        expectCode("REQUEST_CHANGED", () -> scoped(() -> saves.save(createKey, created.id(), input(created.version(), "원본"))));
        var changed = scoped(() -> saves.save(updateKey, created.id(), input(created.version(), "수정")));
        expectCode("REQUEST_CHANGED", () -> scoped(() -> saves.save(updateKey, created.id() + 1, input(created.version(), "수정"))));
        expectCode("SAVE_RESULT_CHANGED", () -> scoped(() -> saves.save(createKey, null, input(null, "원본"))));
        assertThat(scoped(() -> saves.status(createKey))).isEqualTo(new MatchSaveService.Status(created.id(), created.version(), true));
        scoped(() -> { matches.delete(changed.id(), changed.version()); return null; });
        expectCode("SAVE_RESULT_CHANGED", () -> scoped(() -> saves.save(createKey, null, input(null, "원본"))));
        expectCode("SAVE_RESULT_CHANGED", () -> scoped(() -> saves.save(updateKey, created.id(), input(created.version(), "수정"))));
        assertThat(scoped(() -> saves.status(createKey))).isEqualTo(new MatchSaveService.Status(created.id(), created.version(), false));
        assertThat(count("match_records")).isZero();
        assertThat(count("match_record_events")).isEqualTo(3);
        assertThat(count("match_save_requests")).isEqualTo(2);
    }

    @Test void teamAndStableAccountIdScopeReceiptsIndependently() {
        UUID key = UUID.randomUUID();
        var first = scoped(() -> saves.save(key, null, input(null, "첫 계정")));
        expectCode("SAVE_REQUEST_NOT_FOUND", () -> scoped(2, "test-admin", () -> saves.status(key)));
        expectCode("SAVE_REQUEST_NOT_FOUND", () -> scoped(1, "test-member", () -> saves.status(key)));
        var second = scoped(1, "test-member", () -> saves.save(key, null, input(null, "다른 계정")));
        assertThat(second.id()).isNotEqualTo(first.id());
        // Account rename retains receipt ownership because the table stores the immutable database ID.
        jdbc.update("UPDATE accounts SET username='renamed-save-admin' WHERE username='test-admin'");
        try {
            assertThat(scoped(1, "renamed-save-admin", () -> saves.status(key)).matchId()).isEqualTo(first.id());
        } finally { jdbc.update("UPDATE accounts SET username='test-admin' WHERE username='renamed-save-admin'"); }
        assertThat(count("match_save_requests")).isEqualTo(2);
    }

    @Test void validationAndReceiptCommitFailuresRollBackMatchHistoryAndClaimAllowingRetry() {
        UUID invalidKey = UUID.randomUUID(), failedKey = UUID.randomUUID();
        var base = input(null, "검증");
        var invalid = new MatchRequest(base.playedOn(), LocalTime.of(7, 15), base.venue(), base.opponent(), base.notes(), null,
                base.participants(), base.quarters());
        assertThatThrownBy(() -> scoped(() -> saves.save(invalidKey, null, invalid))).isInstanceOf(IllegalArgumentException.class);
        assertThat(count("match_save_requests")).isZero();
        assertThat(count("match_records")).isZero();
        expectCode("SAVE_REQUEST_NOT_FOUND", () -> scoped(() -> saves.status(invalidKey)));
        jdbc.execute("ALTER TABLE match_save_requests ADD CONSTRAINT reject_test_receipt CHECK (completed_at IS NULL)");
        try {
            assertThatThrownBy(() -> scoped(() -> saves.save(failedKey, null, base))).isInstanceOf(DataAccessException.class);
            assertThat(count("match_save_requests")).isZero();
            assertThat(count("match_records")).isZero();
            assertThat(count("match_record_events")).isZero();
        } finally { jdbc.execute("ALTER TABLE match_save_requests DROP CHECK reject_test_receipt"); }
        var retried = scoped(() -> saves.save(failedKey, null, base));
        assertThat(scoped(() -> saves.status(failedKey)).matchId()).isEqualTo(retried.id());
        assertThat(count("match_records")).isEqualTo(1);
    }

    @Test void concurrentEqualRequestsProduceOneMatchAndConcurrentDifferentPayloadCannotOverwrite() throws Exception {
        for (boolean different : List.of(false, true)) {
            UUID key = UUID.randomUUID();
            var ready = new CountDownLatch(2);
            var start = new CountDownLatch(1);
            try (var workers = Executors.newFixedThreadPool(2)) {
                var tasks = java.util.stream.IntStream.range(0, 2).mapToObj(i -> workers.submit(() -> {
                    ready.countDown();
                    if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Test start timed out");
                    try { return scoped(() -> saves.save(key, null, input(null, different ? "내용" + i : "같은 내용"))); }
                    catch (TeamAccessException conflict) { return conflict.code(); }
                })).toList();
                assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
                start.countDown();
                var results = List.of(tasks.get(0).get(30, TimeUnit.SECONDS), tasks.get(1).get(30, TimeUnit.SECONDS));
                if (different) {
                    assertThat(results.stream().filter(MatchResponse.class::isInstance)).hasSize(1);
                    assertThat(results).contains("REQUEST_CHANGED");
                } else assertThat(results.get(0)).isEqualTo(results.get(1));
            }
        }
        assertThat(count("match_records")).isEqualTo(2);
        assertThat(count("match_record_events")).isEqualTo(2);
        assertThat(count("match_save_requests")).isEqualTo(2);
    }
}
