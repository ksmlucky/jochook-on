package com.jochookon.match;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static com.jochookon.player.TeamScopedRequests.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.jochookon.auth.AccountUserDetailsService;
import com.jochookon.config.SecurityConfig;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(MatchController.class) @Import(SecurityConfig.class) @WithMockUser(roles = "MEMBER")
class MatchControllerTest extends com.jochookon.team.TeamMvcTestSupport {
    @Autowired MockMvc mvc;
    @MockitoBean MatchService service;
    @MockitoBean MatchSaveService saves;
    @MockitoBean AccountUserDetailsService userDetailsService;
    @Test void membersReadButCannotCreateOrUpdate() throws Exception {
        given(service.list(0, 10)).willReturn(new MatchResponse.Page(List.of(), 0, 0, 0));
        mvc.perform(get("/api/v1/matches")).andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(post("/api/v1/matches").with(csrf())).andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/matches/1").with(csrf())).andExpect(status().isForbidden());
    }
    @Test @WithAnonymousUser void anonymousCannotRead() throws Exception {
        mvc.perform(get("/api/v1/matches")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/matches/1")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }
    @Test @WithMockUser(roles = "DIRECTOR") void csrfIsRequiredForWrites() throws Exception {
        mvc.perform(post("/api/v1/matches")).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @ParameterizedTest @ValueSource(strings = {"page=-1", "size=0", "size=101"})
    void rejectsInvalidPages(String query) throws Exception {
        mvc.perform(get("/api/v1/matches?" + query)).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test @WithMockUser(roles = "DIRECTOR") void rejectsMissingFieldsAndNullNestedItems() throws Exception {
        mvc.perform(post("/api/v1/matches").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/matches").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"playedOn":"2026-10-18","venue":"","opponent":"","notes":"","participants":[null],"quarters":[null,null,null,null]}
                """)).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void returnsNotFoundMessage() throws Exception {
        given(service.get(99)).willThrow(new MatchNotFoundException());
        mvc.perform(get("/api/v1/matches/99")).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MATCH_NOT_FOUND"));
    }
    @ParameterizedTest @ValueSource(strings = {"DIRECTOR", "COACH"})
    void directorAndCoachCanDeleteMatchingVersion(String role) throws Exception {
        mvc.perform(delete("/api/v1/matches/12?version=3").header("X-Team-Id", "1").with(csrf()).with(user("staff").roles(role)))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        verify(service).delete(12, 3);
    }
    @ParameterizedTest @ValueSource(strings = {"MEMBER", "SERVICE_ADMIN"})
    void teamMemberAndServiceAdminWithoutTeamStaffRoleCannotDelete(String role) throws Exception {
        mvc.perform(delete("/api/v1/matches/12?version=3").header("X-Team-Id", "1").with(csrf()).with(user("reader").roles(role)))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @Test @WithAnonymousUser void anonymousCannotDelete() throws Exception {
        mvc.perform(delete("/api/v1/matches/12?version=3").header("X-Team-Id", "1").with(csrf()))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }
    @Test @WithMockUser(roles = "DIRECTOR") void deletingRequiresCsrfAndMatchingTeamHeader() throws Exception {
        mvc.perform(delete("/api/v1/matches/12?version=3").header("X-Team-Id", "1"))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/matches/12?version=3").with(csrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_CHANGED"));
        mvc.perform(delete("/api/v1/matches/12?version=3").header("X-Team-Id", "2").with(csrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_CHANGED"));
        verifyNoInteractions(service);
    }
    @ParameterizedTest @ValueSource(strings = {"", "?version=-1", "?version=", "?version=abc", "?version=9223372036854775808"})
    @WithMockUser(roles = "DIRECTOR") void deletingRequiresNonnegativeVersion(String query) throws Exception {
        mvc.perform(delete("/api/v1/matches/12" + query).header("X-Team-Id", "1").with(csrf()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        verifyNoInteractions(service);
    }
    @Test @WithMockUser(roles = "DIRECTOR") void missingAndChangedMatchesCannotBeDeleted() throws Exception {
        doThrow(new MatchNotFoundException()).when(service).delete(99, 0);
        doThrow(new org.springframework.orm.ObjectOptimisticLockingFailureException(MatchRecord.class, 12L)).when(service).delete(12, 0);
        mvc.perform(delete("/api/v1/matches/99?version=0").header("X-Team-Id", "1").with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MATCH_NOT_FOUND"));
        mvc.perform(delete("/api/v1/matches/12?version=0").header("X-Team-Id", "1").with(csrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MATCH_CONFLICT"));
    }
}
