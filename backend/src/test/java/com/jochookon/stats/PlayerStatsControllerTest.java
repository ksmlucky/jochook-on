package com.jochookon.stats;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jochookon.auth.AccountUserDetailsService;
import com.jochookon.config.SecurityConfig;
import com.jochookon.team.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.Authentication;
import org.springframework.security.test.context.support.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(PlayerStatsController.class) @Import(SecurityConfig.class) @WithMockUser(roles = "MEMBER")
class PlayerStatsControllerTest extends TeamMvcTestSupport {
    @Autowired MockMvc mvc;
    @MockitoBean PlayerStatsService service;
    @MockitoBean AccountUserDetailsService userDetailsService;
    final String path = "/api/v1/stats/players";

    @ParameterizedTest @ValueSource(strings = {"MEMBER", "COACH", "DIRECTOR"})
    void membersAndStaffCanReadWithSafeDefaults(String role) throws Exception {
        given(service.list(null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false)).willReturn(empty());
        mvc.perform(get(path).header("X-Team-Id", "1").with(user("reader").roles(role)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.kind").value("EXTERNAL"))
                .andExpect(jsonPath("$.recordScope").value("COMPLETED"))
                .andExpect(jsonPath("$.includeGuests").value(false)).andExpect(jsonPath("$.items").isEmpty());
        verify(service).list(null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false);
    }
    @Test void allRequestedFiltersAreForwarded() throws Exception {
        mvc.perform(get(path + "?year=2025&kind=INTERNAL&recordScope=RECORDED&includeGuests=true").header("X-Team-Id", "1"))
                .andExpect(status().isOk());
        verify(service).list(2025, StatsMatchKind.INTERNAL, StatsRecordScope.RECORDED, true);
    }
    @ParameterizedTest @ValueSource(strings = {"year=999", "year=10000", "year=abc", "kind=UNKNOWN",
            "recordScope=LEGACY", "includeGuests=perhaps"})
    void rejectsMalformedAndOutOfRangeFilters(String query) throws Exception {
        mvc.perform(get(path + "?" + query).header("X-Team-Id", "1"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        verifyNoInteractions(service);
    }
    @Test @WithAnonymousUser void anonymousAccessIsRejected() throws Exception {
        mvc.perform(get(path).header("X-Team-Id", "1")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }
    @Test void missingOrChangedTeamIsRejectedBeforeTheService() throws Exception {
        mvc.perform(get(path)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_CHANGED"));
        mvc.perform(get(path).header("X-Team-Id", "2")).andExpect(status().isConflict());
        verifyNoInteractions(service);
    }
    @Test void teamCodeSessionsAreAllowedButCannotWrite() throws Exception {
        given(teamSessions.inspect(nullable(Authentication.class), any(HttpServletRequest.class)))
                .willReturn(new TeamSessionService.Access(new TeamDtos.CurrentUser(null, "MEMBER", "TEAM_CODE", false,
                        new TeamDtos.Team(1L, "검증 팀", "", "ACTIVE"), List.of()), null));
        given(service.list(null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false)).willReturn(empty());
        mvc.perform(get(path).header("X-Team-Id", "1")).andExpect(status().isOk());
        mvc.perform(post(path).header("X-Team-Id", "1").with(csrf())).andExpect(status().isForbidden());
    }
    @Test void anAccountWithNoSelectedTeamCannotReadStats() throws Exception {
        given(teamSessions.inspect(nullable(Authentication.class), any(HttpServletRequest.class)))
                .willReturn(new TeamSessionService.Access(new TeamDtos.CurrentUser("owner", "MEMBER", "ACCOUNT", true,
                        null, List.of()), 1L));
        mvc.perform(get(path).header("X-Team-Id", "1")).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("TEAM_REQUIRED"));
        verifyNoInteractions(service);
    }
    private PlayerStatsResponse empty() {
        return new PlayerStatsResponse(2026, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false,
                List.of(2026), 0, 0, 0, 0, List.of());
    }
}
