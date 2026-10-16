package com.jochookon.auth;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.jochookon.config.SecurityConfig;
import com.jochookon.team.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.TestSecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest({AccountRecoveryController.class, PasswordResetController.class})
@Import({SecurityConfig.class, TeamSessionService.class, AccessRateLimiter.class, TeamErrorHandler.class})
class PasswordResetControllerTest {
    private static final String TOKEN = "a".repeat(43);
    private static final String TOKEN_JSON = "{\"token\":\"" + TOKEN + "\"}";
    @Autowired MockMvc mvc;
    @Autowired TeamSessionService sessions;
    @MockitoBean TeamStore store;
    @MockitoBean PasswordResetService resets;
    @BeforeEach void setup() {
        when(store.account("test-owner")).thenReturn(Optional.of(new TeamStore.AccountInfo(1, "test-owner", "hash", true, true, 0)));
        when(store.account("test-coach")).thenReturn(Optional.of(new TeamStore.AccountInfo(2, "test-coach", "hash", true, false, 0)));
        when(store.memberships(anyLong())).thenReturn(List.of());
    }
    @AfterEach void cleanup() { TestSecurityContextHolder.clearContext(); }
    private MockHttpSession login(String username) {
        var request = new MockHttpServletRequest();
        sessions.beginAccount(username, null, 0, request, new MockHttpServletResponse());
        var session = (MockHttpSession)request.getSession();
        TestSecurityContextHolder.clearContext();
        return session;
    }
    @Test void onlyServiceAdministratorCanSearchAndIssueAndCsrfIsRequired() throws Exception {
        when(resets.accounts(1, "coach")).thenReturn(List.of(new PasswordResetDtos.RecoveryAccount(2, "test-coach", List.of(new PasswordResetDtos.Team(8, "Other club", "COACH")))));
        when(resets.issue(1, 2, true)).thenReturn(new PasswordResetDtos.Issued(TOKEN, Instant.now().plusSeconds(1800), "test-coach"));
        mvc.perform(get("/api/v1/service/account-recovery/accounts").session(login("test-owner")).param("query", "coach"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].teams[0].teamName").value("Other club"))
                .andExpect(jsonPath("$[0].passwordHash").doesNotExist());
        mvc.perform(post("/api/v1/service/account-recovery/2").session(login("test-owner")).with(csrf()).contentType("application/json").content("{\"identityVerified\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").value(TOKEN));
        mvc.perform(post("/api/v1/service/account-recovery/2").session(login("test-owner")).contentType("application/json").content("{\"identityVerified\":true}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/service/account-recovery/accounts").session(login("test-coach"))).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/service/account-recovery/2").session(login("test-coach")).with(csrf()).contentType("application/json").content("{\"identityVerified\":true}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/service/account-recovery/accounts")).andExpect(status().isUnauthorized());
        verify(resets, times(1)).issue(anyLong(), anyLong(), anyBoolean());
    }
    @Test void inspectionIsPublicButCsrfProtectedAndDoesNotComplete() throws Exception {
        when(resets.inspect(TOKEN)).thenReturn(new PasswordResetDtos.Inspected("test-coach", Instant.now().plusSeconds(1800)));
        mvc.perform(post("/api/v1/auth/password-reset/inspect").with(csrf()).contentType("application/json").content(TOKEN_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.username").value("test-coach"));
        mvc.perform(post("/api/v1/auth/password-reset/inspect").contentType("application/json").content(TOKEN_JSON)).andExpect(status().isForbidden());
        verify(resets, never()).complete(anyString(), anyString());
    }
    @Test void completionClearsEvenAnotherAccountsCurrentSessionAndDoesNotLogInAsTarget() throws Exception {
        var session = login("test-owner");
        String input = "{\"token\":\"" + TOKEN + "\",\"newPassword\":\"test-new-password\"}";
        mvc.perform(post("/api/v1/auth/password-reset/complete").session(session).with(csrf()).contentType("application/json").content(input))
                .andExpect(status().isNoContent());
        assertThat(session.isInvalid()).isTrue();
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/password-reset/complete").contentType("application/json").content(input)).andExpect(status().isForbidden());
        verify(resets).complete(TOKEN, "test-new-password");
    }
    @Test void invalidLinkAttemptsUseExistingIpAndSessionLimiter() throws Exception {
        when(resets.inspect(TOKEN)).thenThrow(new TeamAccessException(400, "RESET_LINK_INVALID", "유효하지 않은 링크"));
        var session = new MockHttpSession();
        for (int i=0; i<10; i++) mvc.perform(post("/api/v1/auth/password-reset/inspect").session(session).with(csrf())
                        .with(r -> { r.setRemoteAddr("127.0.0.38"); return r; }).contentType("application/json").content(TOKEN_JSON))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("RESET_LINK_INVALID"));
        mvc.perform(post("/api/v1/auth/password-reset/inspect").session(session).with(csrf())
                        .with(r -> { r.setRemoteAddr("127.0.0.38"); return r; }).contentType("application/json").content(TOKEN_JSON))
                .andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"));
    }
}
