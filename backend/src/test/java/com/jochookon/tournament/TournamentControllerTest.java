package com.jochookon.tournament;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
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
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(TournamentController.class) @Import(SecurityConfig.class) @WithMockUser(roles = "MEMBER")
class TournamentControllerTest extends com.jochookon.team.TeamMvcTestSupport {
    @Autowired MockMvc mvc;
    @MockitoBean TournamentService service;
    @MockitoBean AccountUserDetailsService accounts;
    static final String BODY = """
            {"name":"가상 대회","startDate":"2026-10-01","endDate":"2026-10-02","venue":"","division":"30대부","notes":""}
            """;
    @Test void memberReadsAndTeamHeaderIsMandatory() throws Exception {
        when(service.list(0, 10)).thenReturn(new TournamentResponse.Page(List.of(), 0, 0, 0));
        mvc.perform(get("/api/v1/tournaments").header("X-Team-Id", 1)).andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get("/api/v1/tournaments")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_CHANGED"));
        mvc.perform(get("/api/v1/tournaments/1").header("X-Team-Id", 2)).andExpect(status().isConflict());
    }
    @ParameterizedTest @ValueSource(strings = {"DIRECTOR", "COACH"})
    void onlyStaffCanCreateAndUpdateWithCsrf(String role) throws Exception {
        mvc.perform(post("/api/v1/tournaments").header("X-Team-Id", 1).with(user("staff").roles(role)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isCreated());
        verify(service).create(any());
        mvc.perform(put("/api/v1/tournaments/1").header("X-Team-Id", 1).with(user("staff").roles(role)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isOk());
        mvc.perform(post("/api/v1/tournaments").header("X-Team-Id", 1).with(user("staff").roles(role))
                .contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());
    }
    @ParameterizedTest @ValueSource(strings = {"MEMBER", "SERVICE_ADMIN"})
    void readMembersAndServiceAdminCannotWriteWithoutTeamStaffRole(String role) throws Exception {
        mvc.perform(post("/api/v1/tournaments").header("X-Team-Id", 1).with(user("reader").roles(role)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/tournaments/1").header("X-Team-Id", 1).with(user("reader").roles(role)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @ParameterizedTest @ValueSource(strings = {"page=-1", "size=0", "size=101", "month=2", "year=999", "year=10000", "year=2024&month=0", "year=2024&month=13"})
    void validatesPagination(String query) throws Exception {
        mvc.perform(get("/api/v1/tournaments?" + query).header("X-Team-Id", 1)).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void yearMonthAndYearsEndpointAreAvailableToMembers() throws Exception {
        mvc.perform(get("/api/v1/tournaments?year=2024&month=2").header("X-Team-Id", 1)).andExpect(status().isOk());
        verify(service).list(0, 10, 2024, 2);
        when(service.years()).thenReturn(List.of(2026, 2025, 2024));
        mvc.perform(get("/api/v1/tournaments/years").header("X-Team-Id", 1)).andExpect(status().isOk()).andExpect(content().json("[2026,2025,2024]"));
        mvc.perform(get("/api/v1/tournaments/years")).andExpect(status().isConflict());
    }
    @Test void monthRangeIsForwarded() throws Exception {
        mvc.perform(get("/api/v1/tournaments?startMonth=2023-12&endMonth=2024-02").header("X-Team-Id", 1)).andExpect(status().isOk());
        verify(service).list(0, 10, null, null, "2023-12", "2024-02");
    }
    @ParameterizedTest @ValueSource(strings = {"startMonth=2026-03", "endMonth=2026-06", "startMonth=2026-06&endMonth=2026-03",
            "startMonth=2026-3&endMonth=2026-06", "startMonth=2026-03&endMonth=2026-06&year=2026", "startMonth=2026-03&endMonth=2026-06&month=3"})
    void invalidMonthRangesNeverReachTournamentQueries(String query) throws Exception {
        mvc.perform(get("/api/v1/tournaments?" + query).header("X-Team-Id", 1)).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void missingAndCrossTeamUseSame404AndUpdatesConflict() throws Exception {
        when(service.get(99)).thenThrow(new TournamentNotFoundException());
        mvc.perform(get("/api/v1/tournaments/99").header("X-Team-Id", 1)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TOURNAMENT_NOT_FOUND"));
        when(service.update(eq(1L), any())).thenThrow(new org.springframework.orm.ObjectOptimisticLockingFailureException(Tournament.class, 1L));
        mvc.perform(put("/api/v1/tournaments/1").header("X-Team-Id", 1).with(user("staff").roles("DIRECTOR")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TOURNAMENT_CONFLICT"));
    }
    @Test void missingRequiredAndOversizeFieldsAreRejected() throws Exception {
        for (String body : List.of("{}", BODY.replace("가상 대회", "x".repeat(121)), BODY.replace("30대부", "x".repeat(81))))
            mvc.perform(post("/api/v1/tournaments").header("X-Team-Id", 1).with(user("staff").roles("COACH")).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
}
