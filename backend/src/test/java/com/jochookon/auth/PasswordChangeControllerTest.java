package com.jochookon.auth;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.jochookon.config.SecurityConfig;
import com.jochookon.team.*;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, TeamSessionService.class, AccessRateLimiter.class, TeamErrorHandler.class})
class PasswordChangeControllerTest {
    private static final String PATH = "/api/v1/auth/password/change";
    private static final String INPUT = "{\"currentPassword\":\"test-current-password\",\"newPassword\":\"test-next-password\"}";
    @Autowired MockMvc mvc;
    @Autowired TeamSessionService sessions;
    @MockitoBean TeamStore store;
    @MockitoBean PasswordChangeService passwords;
    @BeforeEach void setup() {
        when(store.account("test-owner")).thenReturn(Optional.of(new TeamStore.AccountInfo(7, "test-owner", "hash", true, true, 2)));
        when(store.memberships(7)).thenReturn(List.of());
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }
    private MockHttpSession personalSession() {
        var request = new MockHttpServletRequest();
        sessions.beginAccount("test-owner", null, 2L, request, new MockHttpServletResponse());
        return (MockHttpSession) request.getSession();
    }
    @Test void personalServiceOwnerWithoutSelectedTeamCanChangeAndIsLoggedOut() throws Exception {
        var session = personalSession();
        mvc.perform(post(PATH).session(session).with(csrf()).contentType("application/json").content(INPUT))
                .andExpect(status().isNoContent());
        assertThat(session.isInvalid()).isTrue();
        verify(passwords).change(7, 2, "test-current-password", "test-next-password");
    }
    @Test void anonymousAndMissingCsrfCannotChangePassword() throws Exception {
        mvc.perform(post(PATH).with(csrf()).contentType("application/json").content(INPUT)).andExpect(status().isUnauthorized());
        mvc.perform(post(PATH).session(personalSession()).contentType("application/json").content(INPUT)).andExpect(status().isForbidden());
        verifyNoInteractions(passwords);
    }
    @Test void viewerTeamCodeCannotChangeAnyPersonalPassword() throws Exception {
        var now = Instant.now();
        var code = new TeamStore.CodeInfo(1, "hash", "password-hash", 1, now, now.plusSeconds(3600), null);
        var team = new TeamDtos.Team(1, "Example club", "", "ACTIVE");
        when(store.code(1)).thenReturn(Optional.of(code)); when(store.team(1)).thenReturn(Optional.of(team));
        var request = new MockHttpServletRequest();
        sessions.beginCode(code, team, request, new MockHttpServletResponse());
        mvc.perform(post(PATH).session((MockHttpSession) request.getSession()).with(csrf()).contentType("application/json").content(INPUT))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCOUNT_REQUIRED"));
        verifyNoInteractions(passwords);
    }
    @Test void wrongPasswordKeepsSessionAndRepeatedAttemptsAreLimited() throws Exception {
        doThrow(new TeamAccessException(400, "CURRENT_PASSWORD_INCORRECT", "현재 비밀번호가 맞지 않습니다."))
                .when(passwords).change(anyLong(), anyLong(), anyString(), anyString());
        var session = personalSession();
        for (int i = 0; i < 10; i++) {
            mvc.perform(post(PATH).session(session).with(csrf()).with(r -> {r.setRemoteAddr("127.0.0.22"); return r;})
                            .contentType("application/json").content(INPUT))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CURRENT_PASSWORD_INCORRECT"));
        }
        mvc.perform(post(PATH).session(session).with(csrf()).with(r -> {r.setRemoteAddr("127.0.0.22"); return r;})
                        .contentType("application/json").content(INPUT))
                .andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"));
        assertThat(session.isInvalid()).isFalse();
        verify(passwords, times(10)).change(anyLong(), anyLong(), anyString(), anyString());
    }
}
