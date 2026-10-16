package com.jochookon.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jochookon.config.SecurityConfig;
import com.jochookon.team.TeamMvcTestSupport;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, AccountUserDetailsService.class})
class AuthControllerTest extends TeamMvcTestSupport {
    @Autowired MockMvc mvc;
    @Autowired PasswordEncoder encoder;
    @MockitoBean AccountRepository accounts;
    @MockitoBean PasswordChangeService passwords;

    @BeforeEach
    void account() {
        given(accounts.findByUsername("test-admin"))
                .willReturn(Optional.of(Account.create("test-admin", encoder.encode("test-only-password"), AccountRole.ADMIN)));
    }

    @Test
    void csrfIsPublicButCurrentUserIsPrivate() throws Exception {
        mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.headerName").value("X-CSRF-TOKEN"))
                .andExpect(jsonPath("$.token").isNotEmpty());
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void loginRotatesSessionAndLogoutInvalidatesIt() throws Exception {
        MockHttpSession before = new MockHttpSession();
        String previousId = before.getId();
        var result = mvc.perform(post("/api/v1/auth/login").session(before).with(csrf())
                        .param("username", "test-admin").param("password", "test-only-password"))
                .andExpect(status().isNoContent()).andReturn();
        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
        assertThat(session).isNotNull();
        assertThat(session.getId()).isNotEqualTo(previousId);
        mvc.perform(get("/api/v1/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("test-admin"))
                .andExpect(jsonPath("$.role").value("MEMBER"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
        mvc.perform(post("/api/v1/auth/logout").session(session).with(csrf()))
                .andExpect(status().isNoContent());
        assertThat(session.isInvalid()).isTrue();
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void wrongPasswordDoesNotAuthenticateTheSession() throws Exception {
        var result = mvc.perform(post("/api/v1/auth/login").with(csrf())
                        .param("username", "test-admin").param("password", "incorrect"))
                .andExpect(status().isUnauthorized()).andReturn();
        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
        var me = get("/api/v1/auth/me");
        if (session != null) me.session(session);
        mvc.perform(me).andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsLoginAndLogoutWithoutCsrf() throws Exception {
        mvc.perform(post("/api/v1/auth/login").param("username", "test-admin").param("password", "test-only-password"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/logout").with(user("test-admin").roles("ADMIN")))
                .andExpect(status().isForbidden());
    }

    @Test
    void memberCannotAccessAdminRoutes() throws Exception {
        mvc.perform(get("/api/v1/admin/settings").with(user("test-member").roles("MEMBER")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/auth/me").with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("MEMBER"));
    }
}
