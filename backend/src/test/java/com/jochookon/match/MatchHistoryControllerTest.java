package com.jochookon.match;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
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
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(MatchHistoryController.class) @Import(SecurityConfig.class) @WithMockUser(roles = "DIRECTOR")
class MatchHistoryControllerTest extends com.jochookon.team.TeamMvcTestSupport {
    @Autowired MockMvc mvc;
    @MockitoBean MatchHistoryService history;
    @MockitoBean AccountUserDetailsService userDetailsService;
    @ParameterizedTest @ValueSource(strings = {"DIRECTOR", "COACH"})
    void staffCanReadHistoryWithoutAnExistingMatch(String role) throws Exception {
        given(history.list(0, 10, 42L)).willReturn(new MatchHistory.Page(List.of(), 0, 0, 0));
        mvc.perform(get("/api/v1/matches/history?matchId=42").header("X-Team-Id", "1").with(user("staff").roles(role)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        verify(history).list(0, 10, 42L);
    }
    @ParameterizedTest @ValueSource(strings = {"MEMBER", "SERVICE_ADMIN"})
    void membersAndServiceAdminAloneCannotReadHistory(String role) throws Exception {
        for (String path : List.of("/api/v1/matches/history", "/api/v1/matches/history/1"))
            mvc.perform(get(path).header("X-Team-Id", "1").with(user("reader").roles(role))).andExpect(status().isForbidden());
        verifyNoInteractions(history);
    }
    @Test @WithAnonymousUser void anonymousCannotReadHistory() throws Exception {
        mvc.perform(get("/api/v1/matches/history").header("X-Team-Id", "1")).andExpect(status().isUnauthorized());
        verifyNoInteractions(history);
    }
    @Test void teamHeaderIsRequiredAndMustMatchSelectedTeam() throws Exception {
        mvc.perform(get("/api/v1/matches/history")).andExpect(status().isConflict());
        mvc.perform(get("/api/v1/matches/history/1").header("X-Team-Id", "2")).andExpect(status().isConflict());
        verifyNoInteractions(history);
    }
    @ParameterizedTest @ValueSource(strings = {"page=-1", "size=0", "size=101", "matchId=0", "matchId=abc"})
    void validatesPaginationAndMatchFilter(String query) throws Exception {
        mvc.perform(get("/api/v1/matches/history?" + query).header("X-Team-Id", "1")).andExpect(status().isBadRequest());
        verifyNoInteractions(history);
    }
    @Test void unknownEventReturnsHistoryNotFound() throws Exception {
        given(history.get(99)).willThrow(new MatchHistoryNotFoundException());
        mvc.perform(get("/api/v1/matches/history/99").header("X-Team-Id", "1"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MATCH_HISTORY_NOT_FOUND"));
    }
    @Test void historyCannotBeUpdatedOrDeleted() throws Exception {
        mvc.perform(put("/api/v1/matches/history/1").header("X-Team-Id", "1").with(csrf())).andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/matches/history/1").header("X-Team-Id", "1").with(csrf())).andExpect(status().isForbidden());
        verifyNoInteractions(history);
    }
}
