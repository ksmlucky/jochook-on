package com.jochookon.match;

import static com.jochookon.player.TeamScopedRequests.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.jochookon.auth.AccountUserDetailsService;
import com.jochookon.config.SecurityConfig;
import com.jochookon.team.TeamAccessException;
import java.util.List;
import java.util.UUID;
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
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(MatchController.class) @Import(SecurityConfig.class)
@WithMockUser(username = "test-admin", roles = "DIRECTOR")
class MatchSaveControllerTest extends com.jochookon.team.TeamMvcTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockitoBean MatchService matches;
    @MockitoBean MatchSaveService saves;
    @MockitoBean AccountUserDetailsService users;
    private final UUID key = UUID.randomUUID();
    private MatchRequest input(Long version) { return MatchTestData.request(version, List.of(), List.of()); }
    private MatchResponse result(long version) {
        var request = input(version);
        return new MatchResponse(12L, version, request.playedOn(), request.kickoff(), request.venue(), request.opponent(), request.notes(),
                List.of(), request.quarters(), List.of(), null, null, request.kind(), RecordingStage.ATTENDANCE);
    }
    @Test void optionalHeaderKeepsOldClientsAndUsesReceiptForKeyedCreateAndUpdate() throws Exception {
        given(matches.create(any())).willReturn(result(0));
        given(matches.update(eq(12L), any())).willReturn(result(1));
        given(saves.save(eq(key), isNull(), any())).willReturn(result(0));
        given(saves.save(eq(key), eq(12L), any())).willReturn(result(1));
        mvc.perform(post("/api/v1/matches").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input(null))))
                .andExpect(status().isCreated());
        mvc.perform(put("/api/v1/matches/12").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input(0L))))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/matches").header("Idempotency-Key", key).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input(null))))
                .andExpect(status().isCreated()).andExpect(header().string("Location", "/api/v1/matches/12"));
        mvc.perform(put("/api/v1/matches/12").header("Idempotency-Key", key).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input(0L))))
                .andExpect(status().isOk());
        verify(matches).create(input(null)); verify(matches).update(12, input(0L));
        verify(saves).save(key, null, input(null)); verify(saves).save(key, 12L, input(0L));
    }
    @ParameterizedTest @ValueSource(strings = {"DIRECTOR", "COACH"})
    void authorizedStaffCanReadOnlyTheirReceipt(String role) throws Exception {
        given(saves.status(key)).willReturn(new MatchSaveService.Status(12, 1, true));
        mvc.perform(get("/api/v1/matches/save-requests/" + key).with(user("staff").roles(role)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.matchId").value(12))
                .andExpect(jsonPath("$.version").value(1)).andExpect(jsonPath("$.exists").value(true));
    }
    @ParameterizedTest @ValueSource(strings = {"MEMBER", "SERVICE_ADMIN"})
    void readersAndUnassignedServiceAdminCannotReadReceiptOrSave(String role) throws Exception {
        mvc.perform(get("/api/v1/matches/save-requests/" + key).with(user("reader").roles(role))).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/matches").header("Idempotency-Key", key).with(csrf()).with(user("reader").roles(role)))
                .andExpect(status().isForbidden());
        verifyNoInteractions(saves, matches);
    }
    @Test @WithAnonymousUser void anonymousCannotReadOrWrite() throws Exception {
        mvc.perform(get("/api/v1/matches/save-requests/" + key)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/matches").header("Idempotency-Key", key).with(csrf())).andExpect(status().isUnauthorized());
        verifyNoInteractions(saves, matches);
    }
    @Test void csrfExpectedTeamAndUuidAreStillRequired() throws Exception {
        mvc.perform(post("/api/v1/matches").header("Idempotency-Key", key)).andExpect(status().isForbidden());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/matches/save-requests/" + key))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_CHANGED"));
        mvc.perform(get("/api/v1/matches/save-requests/not-a-uuid")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/matches").header("Idempotency-Key", "not-a-uuid").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(input(null)))).andExpect(status().isBadRequest());
        verifyNoInteractions(saves, matches);
    }
    @Test void exposesStableConflictAndNotFoundCodes() throws Exception {
        given(saves.status(key)).willThrow(new TeamAccessException(404, "SAVE_REQUEST_NOT_FOUND", "없음"));
        mvc.perform(get("/api/v1/matches/save-requests/" + key)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("SAVE_REQUEST_NOT_FOUND"));
        for (String code : List.of("REQUEST_CHANGED", "SAVE_RESULT_CHANGED")) {
            given(saves.save(eq(key), isNull(), any())).willThrow(new TeamAccessException(409, code, "변경"));
            mvc.perform(post("/api/v1/matches").header("Idempotency-Key", key).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(input(null)))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value(code));
        }
    }
}
