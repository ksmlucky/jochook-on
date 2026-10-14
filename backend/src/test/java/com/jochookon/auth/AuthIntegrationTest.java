package com.jochookon.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

@Tag("integration")
@Testcontainers
@SpringBootTest(properties = {"spring.datasource.password=unused-test-password",
        "jochookon.bootstrap.admin.username=", "jochookon.bootstrap.admin.password="})
@AutoConfigureMockMvc
class AuthIntegrationTest {
    @Container @ServiceConnection
    static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");

    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    @Autowired MockMvc mvc;

    @BeforeEach
    void isolatedMember() {
        jdbc.update("DELETE FROM accounts");
        jdbc.update("INSERT INTO accounts (username, password_hash, role, enabled) VALUES (?, ?, ?, ?)",
                "test-member", encoder.encode("test-only-password"), "MEMBER", true);
    }

    @Test
    void persistedMemberCanLogInReadPlayersAndLogOut() throws Exception {
        var login = mvc.perform(post("/api/v1/auth/login").with(csrf())
                        .param("username", "test-member").param("password", "test-only-password"))
                .andExpect(status().isNoContent()).andReturn();
        MockHttpSession session = (MockHttpSession) login.getRequest().getSession(false);
        mvc.perform(get("/api/v1/auth/me").session(session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("MEMBER"));
        mvc.perform(get("/api/v1/players").session(session)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/admin/settings").session(session)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/logout").session(session).with(csrf())).andExpect(status().isNoContent());
        assertThat(session.isInvalid()).isTrue();
    }

    @Test
    void disabledDatabaseAccountCannotLogIn() throws Exception {
        jdbc.update("UPDATE accounts SET enabled = false WHERE username = ?", "test-member");
        mvc.perform(post("/api/v1/auth/login").with(csrf())
                        .param("username", "test-member").param("password", "test-only-password"))
                .andExpect(status().isUnauthorized());
    }
}
