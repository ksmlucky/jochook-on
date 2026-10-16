package com.jochookon.auth;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.jochookon.team.TeamAccessException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import com.jochookon.team.TeamStore;
import static org.mockito.Mockito.doAnswer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.mysql.MySQLContainer;

@Tag("integration") @Testcontainers
@SpringBootTest(properties = {"spring.datasource.password=unused-test-password",
        "jochookon.bootstrap.admin.username=", "jochookon.bootstrap.admin.password=", "jochookon.bootstrap.service-admin-username="})
@AutoConfigureMockMvc
class PasswordResetIntegrationTest {
    @Container @ServiceConnection static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordResetService resets;
    @Autowired PasswordChangeService changes;
    @Autowired MockMvc mvc;
    @Autowired DataSource dataSource;
    @MockitoSpyBean TeamStore store;
    String prefix, username, fixtureHash;
    long owner, target, team;
    @BeforeEach void syntheticAccountsOnly() {
        prefix = "reset-" + UUID.randomUUID().toString().substring(0,8);
        fixtureHash = new BCryptPasswordEncoder(4).encode("test-original-password");
        owner = account(prefix + "-owner", true); username = prefix + "-coach"; target = account(username, false);
        jdbc.update("INSERT INTO teams(name,description,status) VALUES (?, '', 'ACTIVE')", prefix + " club");
        team = jdbc.queryForObject("SELECT id FROM teams WHERE name=?", Long.class, prefix + " club");
        membership(target, team, "COACH");
    }
    private long account(String name, boolean admin) {
        jdbc.update("INSERT INTO accounts(username,password_hash,role,enabled,service_admin) VALUES (?,?,'ADMIN',1,?)", name, fixtureHash, admin);
        return jdbc.queryForObject("SELECT id FROM accounts WHERE username=?", Long.class, name);
    }
    private void membership(long account, long club, String role) {
        jdbc.update("INSERT INTO team_memberships(team_id,account_id,role,active) VALUES (?,?,?,1)", club, account, role);
    }
    private MockHttpSession login(String password) throws Exception {
        return (MockHttpSession)mvc.perform(post("/api/v1/auth/login").with(csrf()).param("username", username).param("password", password))
                .andExpect(status().isNoContent()).andReturn().getRequest().getSession(false);
    }
    @Test void hashedLinkCanBeInspectedWithoutConsumptionAndCompletesOnceRevokingEverySession() throws Exception {
        var oldSession = login("test-original-password");
        var issued = resets.issue(owner, target, true);
        assertThat(issued.expiresAt()).isBetween(Instant.now().plusSeconds(1790), Instant.now().plusSeconds(1801));
        var row = jdbc.queryForMap("SELECT * FROM account_password_resets WHERE account_id=?", target);
        assertThat(row.get("token_hash")).isEqualTo(PasswordResetService.hash(issued.token())).isNotEqualTo(issued.token());
        assertThat(((Number)row.get("issued_by")).longValue()).isEqualTo(owner);
        assertThat(resets.inspect(issued.token()).username()).isEqualTo(username);
        resets.inspect(issued.token());
        assertThat(jdbc.queryForObject("SELECT used_at FROM account_password_resets WHERE account_id=?", Timestamp.class, target)).isNull();
        mvc.perform(post("/api/v1/auth/password-reset/complete").with(csrf()).contentType("application/json")
                        .content("{\"token\":\"" + issued.token() + "\",\"newPassword\":\"test-replacement-password\"}"))
                .andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT credential_version FROM accounts WHERE id=?", Long.class, target)).isEqualTo(1);
        assertInvalid(() -> resets.complete(issued.token(), "test-another-password"));
        mvc.perform(get("/api/v1/auth/me").session(oldSession)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/me").session(login("test-replacement-password"))).andExpect(status().isOk());
    }
    @Test void reissueRevokesPreviousLinkAndExpiredLinksCannotInspectOrComplete() {
        var first = resets.issue(owner, target, true); var second = resets.issue(owner, target, true);
        assertThat(first.token()).isNotEqualTo(second.token());
        assertInvalid(() -> resets.inspect(first.token()));
        assertInvalid(() -> resets.complete(first.token(), "test-new-password"));
        assertThat(resets.inspect(second.token()).username()).isEqualTo(username);
        jdbc.update("UPDATE account_password_resets SET expires_at=? WHERE token_hash=?", Timestamp.from(Instant.now().minusSeconds(1)), PasswordResetService.hash(second.token()));
        assertInvalid(() -> resets.inspect(second.token()));
        assertInvalid(() -> resets.complete(second.token(), "test-new-password"));
        assertThat(jdbc.queryForObject("SELECT credential_version FROM accounts WHERE id=?", Long.class, target)).isZero();
    }
    @Test void changedPasswordDisabledAccountRemovedRoleOrServicePromotionInvalidatesLink() {
        var changed = resets.issue(owner, target, true);
        changes.change(target, 0, "test-original-password", "test-new-password");
        assertInvalid(() -> resets.inspect(changed.token()));
        var disabled = resets.issue(owner, target, true);
        jdbc.update("UPDATE accounts SET enabled=0 WHERE id=?", target);
        assertInvalid(() -> resets.inspect(disabled.token()));
        jdbc.update("UPDATE accounts SET enabled=1 WHERE id=?", target);
        jdbc.update("UPDATE team_memberships SET active=0 WHERE account_id=?", target);
        assertInvalid(() -> resets.complete(disabled.token(), "test-another-password"));
        jdbc.update("UPDATE team_memberships SET active=1 WHERE account_id=?", target);
        jdbc.update("UPDATE accounts SET service_admin=1 WHERE id=?", target);
        assertInvalid(() -> resets.inspect(disabled.token()));
    }
    @Test void onlyEligibleStaffAppearAcrossTeamsWithMaximumTwentyAccounts() {
        membership(target, 1, "DIRECTOR");
        var listed = resets.accounts(owner, username);
        assertThat(listed).hasSize(1); assertThat(listed.getFirst().teams()).hasSize(2);
        assertThat(listed.getFirst().teams()).extracting(PasswordResetDtos.Team::role).containsExactlyInAnyOrder("COACH", "DIRECTOR");
        var member = account(prefix + "-member", false); membership(member, team, "MEMBER");
        assertThat(resets.accounts(owner, prefix)).extracting(PasswordResetDtos.RecoveryAccount::id).containsExactly(target);
        for (int i=0;i<22;i++) membership(account(prefix + "-extra-" + i, false), team, "COACH");
        assertThat(resets.accounts(owner, prefix)).hasSize(20);
        assertCode(() -> resets.accounts(target, prefix), "FORBIDDEN");
        assertCode(() -> resets.issue(target, target, true), "FORBIDDEN");
        assertCode(() -> resets.issue(owner, owner, true), "RECOVERY_ACCOUNT_UNAVAILABLE");
        assertCode(() -> resets.issue(owner, member, true), "RECOVERY_ACCOUNT_UNAVAILABLE");
        assertCode(() -> resets.issue(owner, target, false), "IDENTITY_VERIFICATION_REQUIRED");
    }
    @Test void invalidPasswordDoesNotConsumeTokenOrModifyCredentials() {
        var issued = resets.issue(owner, target, true);
        assertCode(() -> resets.complete(issued.token(), "short"), "INVALID_NEW_PASSWORD");
        assertCode(() -> resets.complete(issued.token(), "test-original-password"), "PASSWORD_UNCHANGED");
        assertThat(resets.inspect(issued.token()).username()).isEqualTo(username);
        assertThat(jdbc.queryForObject("SELECT password_hash FROM accounts WHERE id=?", String.class, target)).isEqualTo(fixtureHash);
        assertThat(jdbc.queryForObject("SELECT credential_version FROM accounts WHERE id=?", Long.class, target)).isZero();
    }
    @Test void concurrentCompletionsHaveExactlyOneWinner() throws Exception {
        var issued = resets.issue(owner, target, true);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<String> complete = () -> {
                start.await();
                try { resets.complete(issued.token(), "test-replacement-password"); return "completed"; }
                catch (TeamAccessException exception) { return exception.code(); }
            };
            var a = executor.submit(complete); var b = executor.submit(complete); start.countDown();
            assertThat(List.of(a.get(30,TimeUnit.SECONDS),b.get(30,TimeUnit.SECONDS))).containsExactlyInAnyOrder("completed","RESET_LINK_INVALID");
        }
        assertThat(jdbc.queryForObject("SELECT credential_version FROM accounts WHERE id=?", Long.class, target)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM account_password_resets WHERE account_id=? AND used_at IS NOT NULL", Integer.class,target)).isEqualTo(1);
    }
    @Test void roleRevocationCommittedAfterTokenPreviewIsSeenWhenAccountLockBecomesAvailable() throws Exception {
        var issued = resets.issue(owner, target, true);
        var reachedAccountLock = new CountDownLatch(1);
        doAnswer(call -> {
            // complete() has already performed its first nonlocking token read at this point.
            reachedAccountLock.countDown();
            return call.callRealMethod();
        }).when(store).lockedAccount(target);
        try (var blocker = dataSource.getConnection(); var executor = Executors.newSingleThreadExecutor()) {
            blocker.setAutoCommit(false);
            try (var statement = blocker.prepareStatement("SELECT id FROM accounts WHERE id=? FOR UPDATE")) {
                statement.setLong(1, target);
                try (var row = statement.executeQuery()) { assertThat(row.next()).isTrue(); }
            }
            var completion = executor.submit(() -> {
                try { resets.complete(issued.token(), "test-replacement-password"); return "completed"; }
                catch (TeamAccessException exception) { return exception.code(); }
            });
            try {
                assertThat(reachedAccountLock.await(10, TimeUnit.SECONDS)).isTrue();
                // This separate autocommit statement commits while the account lock is still held.
                jdbc.update("UPDATE team_memberships SET role='MEMBER' WHERE account_id=?", target);
                blocker.commit();
                assertThat(completion.get(30, TimeUnit.SECONDS)).isEqualTo("RESET_LINK_INVALID");
            } finally {
                // Release only our test lock even when an assertion fails, before closing the worker.
                blocker.rollback();
            }
        }
        assertThat(jdbc.queryForObject("SELECT credential_version FROM accounts WHERE id=?", Long.class, target)).isZero();
        assertThat(jdbc.queryForObject("SELECT used_at FROM account_password_resets WHERE account_id=?", Timestamp.class, target)).isNull();
    }
    private static void assertInvalid(Runnable action) { assertCode(action, "RESET_LINK_INVALID"); }
    private static void assertCode(Runnable action, String code) {
        assertThatThrownBy(action::run).isInstanceOf(TeamAccessException.class).extracting(e -> ((TeamAccessException)e).code()).isEqualTo(code);
    }
}
