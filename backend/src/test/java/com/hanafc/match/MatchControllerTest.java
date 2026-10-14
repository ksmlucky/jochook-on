package com.hanafc.match;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.hanafc.auth.AccountUserDetailsService;
import com.hanafc.config.SecurityConfig;
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
class MatchControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean MatchService service;
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
    @Test @WithMockUser(roles = "ADMIN") void csrfIsRequiredForWrites() throws Exception {
        mvc.perform(post("/api/v1/matches")).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @ParameterizedTest @ValueSource(strings = {"page=-1", "size=0", "size=101"})
    void rejectsInvalidPages(String query) throws Exception {
        mvc.perform(get("/api/v1/matches?" + query)).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test @WithMockUser(roles = "ADMIN") void rejectsMissingFieldsAndNullNestedItems() throws Exception {
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
}
