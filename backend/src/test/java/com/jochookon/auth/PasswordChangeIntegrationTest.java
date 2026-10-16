package com.jochookon.auth;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.jochookon.team.TeamAccessException;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.mysql.MySQLContainer;

@Tag("integration") @Testcontainers
@SpringBootTest(properties = {"spring.datasource.password=unused-test-password",
        "jochookon.bootstrap.admin.username=", "jochookon.bootstrap.admin.password=", "jochookon.bootstrap.service-admin-username="})
@AutoConfigureMockMvc
class PasswordChangeIntegrationTest {
    @Container @ServiceConnection static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired PasswordChangeService service;
    String username;
    long accountId;
    @BeforeEach void syntheticAccountOnly() {
        username = "change-" + UUID.randomUUID().toString().substring(0, 12);
        jdbc.update("INSERT INTO accounts(username,password_hash,role,enabled,service_admin) VALUES (?,?,'ADMIN',1,1)",
                username, new BCryptPasswordEncoder(4).encode("test-original-password"));
        accountId = jdbc.queryForObject("SELECT id FROM accounts WHERE username=?", Long.class, username);
    }
    private MockHttpSession login(String password) throws Exception {
        return (MockHttpSession) mvc.perform(post("/api/v1/auth/login").with(csrf()).param("username", username).param("password", password))
                .andExpect(status().isNoContent()).andReturn().getRequest().getSession(false);
    }
    @Test void changingPasswordRevokesEveryPreviousSessionAndOnlyNewPasswordCanLogIn() throws Exception {
        var current = login("test-original-password");
        var elsewhere = login("test-original-password");
        var staleTeamSelection = login("test-original-password");
        mvc.perform(post("/api/v1/auth/password/change").session(current).with(csrf()).contentType("application/json")
                        .content("{\"currentPassword\":\"test-original-password\",\"newPassword\":\"test-replacement-password\"}"))
                .andExpect(status().isNoContent());
        assertThat(current.isInvalid()).isTrue();
        assertThat(jdbc.queryForObject("SELECT credential_version FROM accounts WHERE id=?", Long.class, accountId)).isEqualTo(1);
        mvc.perform(get("/api/v1/auth/me").session(elsewhere)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"));
        assertThat(elsewhere.isInvalid()).isTrue();
        mvc.perform(post("/api/v1/auth/team").session(staleTeamSelection).with(csrf()).contentType("application/json").content("{\"teamId\":1}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/login").with(csrf()).param("username", username).param("password", "test-original-password"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/me").session(login("test-replacement-password")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.serviceAdmin").value(true));
    }
    @Test void failedValidationLeavesHashAndVersionUntouchedAndSessionUsable() throws Exception {
        var session = login("test-original-password");
        var before = jdbc.queryForMap("SELECT password_hash,credential_version FROM accounts WHERE id=?", accountId);
        mvc.perform(post("/api/v1/auth/password/change").session(session).with(csrf()).contentType("application/json")
                        .content("{\"currentPassword\":\"wrong\",\"newPassword\":\"test-replacement-password\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CURRENT_PASSWORD_INCORRECT"));
        assertThat(jdbc.queryForMap("SELECT password_hash,credential_version FROM accounts WHERE id=?", accountId)).isEqualTo(before);
        mvc.perform(get("/api/v1/auth/me").session(session)).andExpect(status().isOk());
    }
    @Test void concurrentChangesSerializeOnAccountAndRejectTheNowStaleRequest() throws Exception {
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<String> change = () -> {
                start.await();
                try { service.change(accountId, 0, "test-original-password", "test-replacement-password"); return "changed"; }
                catch (TeamAccessException exception) { return exception.code(); }
            };
            var first = executor.submit(change); var second = executor.submit(change); start.countDown();
            assertThat(java.util.List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder("changed", "SESSION_EXPIRED");
        }
        assertThat(jdbc.queryForObject("SELECT credential_version FROM accounts WHERE id=?", Long.class, accountId)).isEqualTo(1);
    }
}
