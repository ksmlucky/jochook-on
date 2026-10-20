package com.jochookon.team;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.jochookon.auth.AccountUserDetailsService;
import com.jochookon.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(TeamLogoController.class) @Import(SecurityConfig.class)
class TeamLogoControllerTest extends TeamMvcTestSupport {
    static final String URL = "/api/v1/teams/current/logo";
    @Autowired MockMvc mvc;
    @MockitoBean TeamLogoService logos;
    @MockitoBean AccountUserDetailsService users;
    @ParameterizedTest @ValueSource(strings = {"MEMBER", "COACH", "DIRECTOR"})
    void readsOwnTeamPngWithoutPublicCaching(String role) throws Exception {
        given(logos.find(1)).willReturn(new byte[]{1, 2, 3});
        mvc.perform(get(URL).with(user("reader").roles(role)).header("X-Team-Id", "1"))
                .andExpect(status().isOk()).andExpect(content().contentType("image/png"))
                .andExpect(header().string("Cache-Control", "private, no-store"));
        verify(logos).find(1);
    }
    @Test void missingLogoReturns404() throws Exception {
        given(logos.find(1)).willThrow(new TeamAccessException(404, "LOGO_NOT_FOUND", "등록된 팀 로고가 없습니다."));
        mvc.perform(get(URL).with(user("reader").roles("MEMBER")).header("X-Team-Id", "1"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("LOGO_NOT_FOUND"));
    }
    @Test void anonymousAndWrongTeamCannotReadOrWrite() throws Exception {
        mvc.perform(get(URL)).andExpect(status().isUnauthorized());
        mvc.perform(get(URL).with(user("director").roles("DIRECTOR")).header("X-Team-Id", "2")).andExpect(status().isConflict());
        mvc.perform(delete(URL).with(user("director").roles("DIRECTOR")).with(csrf()).header("X-Team-Id", "2")).andExpect(status().isConflict());
        verifyNoInteractions(logos);
    }
    @ParameterizedTest @ValueSource(strings = {"MEMBER", "COACH"})
    void nondirectorsCannotMutate(String role) throws Exception {
        mvc.perform(multipart(HttpMethod.PUT, URL).file(TeamLogoServiceTest.picture(2, 2, "png"))
                .with(user("reader").roles(role)).with(csrf()).header("X-Team-Id", "1")).andExpect(status().isForbidden());
        mvc.perform(delete(URL).with(user("reader").roles(role)).with(csrf()).header("X-Team-Id", "1")).andExpect(status().isForbidden());
        verifyNoInteractions(logos);
    }
    @Test void directorCanUploadAndDeleteWithCsrf() throws Exception {
        var file = TeamLogoServiceTest.picture(2, 2, "png");
        mvc.perform(multipart(HttpMethod.PUT, URL).file(file).with(user("director").roles("DIRECTOR"))
                .with(csrf()).header("X-Team-Id", "1")).andExpect(status().isNoContent());
        mvc.perform(delete(URL).with(user("director").roles("DIRECTOR")).with(csrf()).header("X-Team-Id", "1")).andExpect(status().isNoContent());
        verify(logos).save(1, file); verify(logos).delete(1);
    }
    @Test void csrfIsRequired() throws Exception {
        mvc.perform(delete(URL).with(user("director").roles("DIRECTOR")).header("X-Team-Id", "1")).andExpect(status().isForbidden());
        verifyNoInteractions(logos);
    }
}
