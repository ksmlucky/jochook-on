package com.hanafc.player;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import com.hanafc.auth.AccountUserDetailsService;
import com.hanafc.config.SecurityConfig;
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

@WebMvcTest(GuestPlayerController.class) @Import(SecurityConfig.class)
class GuestPlayerControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean PlayerQueryService queries;
    @MockitoBean PlayerCommandService commands;
    @MockitoBean AccountUserDetailsService users;
    @Test @WithMockUser(roles = "MEMBER") void memberCannotBrowseRegistryOrCreateGuests() throws Exception {
        mvc.perform(get("/api/v1/players/guests")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/players/guests").with(csrf())).andExpect(status().isForbidden());
        verifyNoInteractions(commands, queries);
    }
    @Test @WithAnonymousUser void anonymousCannotReadGuests() throws Exception {
        mvc.perform(get("/api/v1/players/guests")).andExpect(status().isUnauthorized());
        verifyNoInteractions(commands, queries);
    }
    @Test @WithMockUser(roles = "ADMIN") void creationNeedsCsrf() throws Exception {
        mvc.perform(post("/api/v1/players/guests")).andExpect(status().isForbidden()); verifyNoInteractions(commands);
    }
    @ParameterizedTest @WithMockUser(roles = "ADMIN") @ValueSource(strings = {"{}", "{\"name\":\" \"}", "{\"name\":\"검증\",\"shirtNumber\":0}", "{\"name\":\"검증\",\"shirtNumber\":100}"})
    void validatesGuestInput(String body) throws Exception {
        mvc.perform(post("/api/v1/players/guests").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        verifyNoInteractions(commands);
    }
}
