package com.jochookon.match;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static com.jochookon.player.TeamScopedRequests.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.jochookon.auth.AccountUserDetailsService;
import com.jochookon.config.SecurityConfig;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(LineupSuggestionController.class) @Import(SecurityConfig.class) @WithMockUser(roles = "DIRECTOR")
class LineupSuggestionControllerTest extends com.jochookon.team.TeamMvcTestSupport {
    static final String URL = "/api/v1/matches/lineup-suggestion";
    @Autowired MockMvc mvc;
    @MockitoBean LineupSuggestionService service;
    @MockitoBean AccountUserDetailsService userDetailsService;
    @Test void adminReceivesDraft() throws Exception {
        given(service.suggest(any())).willReturn(new LineupSuggestion("test", 0, List.of(), List.of(), List.of(), true));
        mvc.perform(post(URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"playedOn\":\"2026-10-18\",\"playerIds\":[1],\"seed\":0}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.policyVersion").value("test"))
                .andExpect(jsonPath("$.formation").value("F4123"));
        org.mockito.Mockito.verify(service).suggest(org.mockito.ArgumentMatchers.argThat(r -> r.formation() == Formation.F4123));
    }
    @Test void acceptsExplicitFormationAndRejectsUnknownFormation() throws Exception {
        given(service.suggest(any())).willReturn(new LineupSuggestion("test", 0, List.of(), List.of(), List.of(), true, Formation.F4231));
        mvc.perform(post(URL).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playedOn\":\"2026-10-18\",\"playerIds\":[1],\"seed\":0,\"formation\":\"F4231\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.formation").value("F4231"));
        org.mockito.Mockito.verify(service).suggest(org.mockito.ArgumentMatchers.argThat(r -> r.formation() == Formation.F4231));
        mvc.perform(post(URL).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playedOn\":\"2026-10-18\",\"playerIds\":[1],\"seed\":0,\"formation\":\"F999\"}"))
                .andExpect(status().isBadRequest());
    }
    @Test void twoHalfFormatFlowsIntoTheWholeSuggestionRequestAndResponse() throws Exception {
        given(service.suggest(any())).willReturn(new LineupSuggestion("test", 0, List.of(), List.of(), List.of(), true, Formation.F352, MatchFormat.TWO_HALVES_30));
        mvc.perform(post(URL).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playedOn\":\"2026-10-18\",\"playerIds\":[1],\"seed\":0,\"formation\":\"F352\",\"matchFormat\":\"TWO_HALVES_30\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.matchFormat").value("TWO_HALVES_30"));
        org.mockito.Mockito.verify(service).suggest(org.mockito.ArgumentMatchers.argThat(r -> r.matchFormat() == MatchFormat.TWO_HALVES_30));
        mvc.perform(post(URL).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playedOn\":\"2026-10-18\",\"playerIds\":[1],\"seed\":0,\"matchFormat\":\"INVALID\"}"))
                .andExpect(status().isBadRequest());
    }
    @ParameterizedTest @EnumSource(value = Formation.class, names = {"F352", "F343"})
    void acceptsThreeBackFormationAndReturnsItsIdentity(Formation formation) throws Exception {
        given(service.suggest(any())).willReturn(new LineupSuggestion("test", 0, List.of(), List.of(), List.of(), true, formation));
        mvc.perform(post(URL).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playedOn\":\"2026-10-18\",\"playerIds\":[1],\"seed\":0,\"formation\":\"" + formation + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.formation").value(formation.name()));
        org.mockito.Mockito.verify(service).suggest(org.mockito.ArgumentMatchers.argThat(r -> r.formation() == formation));
    }
    @Test @WithMockUser(roles = "MEMBER") void memberCannotCalculate() throws Exception {
        mvc.perform(post(URL).with(csrf())).andExpect(status().isForbidden()); verifyNoInteractions(service);
    }
    @Test @WithAnonymousUser void anonymousCannotCalculate() throws Exception {
        mvc.perform(post(URL).with(csrf())).andExpect(status().isUnauthorized()); verifyNoInteractions(service);
    }
    @Test void csrfRequired() throws Exception {
        mvc.perform(post(URL)).andExpect(status().isForbidden()); verifyNoInteractions(service);
    }
    @ParameterizedTest @ValueSource(strings = {"{}", "{\"playedOn\":\"2026-10-18\",\"playerIds\":[],\"seed\":0}",
            "{\"playedOn\":\"2026-10-18\",\"playerIds\":[null],\"seed\":0}", "{\"playedOn\":\"2026-10-18\",\"playerIds\":[0],\"seed\":0}"})
    void rejectsMalformedInput(String input) throws Exception {
        mvc.perform(post(URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(input)).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
}
