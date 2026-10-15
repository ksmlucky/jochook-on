package com.jochookon.match;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static com.jochookon.player.TeamScopedRequests.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.jochookon.auth.AccountUserDetailsService;
import com.jochookon.config.SecurityConfig;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(MatchImportController.class) @Import(SecurityConfig.class) @WithMockUser(roles = "DIRECTOR")
class MatchImportControllerTest extends com.jochookon.team.TeamMvcTestSupport {
    @Autowired MockMvc mvc;
    @MockitoBean MatchWorkbookService service;
    @MockitoBean AccountUserDetailsService users;
    @Test void adminDownloadsTemplateAndPreviewsMultipart() throws Exception {
        given(service.template(Formation.F4123)).willReturn(new byte[]{1,2,3});
        mvc.perform(get("/api/v1/matches/import/template")).andExpect(status().isOk()).andExpect(header().string("Content-Disposition", "attachment; filename=jochook-on-match.xlsx"));
        var file = new MockMultipartFile("file", "match.xlsx", "", new byte[]{1});
        given(service.preview(file, Formation.F4123)).willReturn(new MatchImportPreview(List.of(), List.of()));
        mvc.perform(multipart("/api/v1/matches/import/preview").file(file).with(csrf())).andExpect(status().isOk()).andExpect(jsonPath("$.valid").value(false));
    }
    @Test @WithMockUser(roles = "MEMBER") void memberCannotImportEvenWithCsrf() throws Exception {
        mvc.perform(get("/api/v1/matches/import/template")).andExpect(status().isForbidden());
        mvc.perform(multipart("/api/v1/matches/import/preview").file(new MockMultipartFile("file", new byte[]{1})).with(csrf())).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @Test void matchFormatIsForwardedAndUnknownFormatIsRejected() throws Exception {
        given(service.template(Formation.F352, MatchFormat.TWO_HALVES_30)).willReturn(new byte[]{1});
        mvc.perform(get("/api/v1/matches/import/template").param("formation", "F352").param("matchFormat", "TWO_HALVES_30")).andExpect(status().isOk());
        org.mockito.Mockito.verify(service).template(Formation.F352, MatchFormat.TWO_HALVES_30);
        var file = new MockMultipartFile("file", "match.xlsx", "", new byte[]{1});
        given(service.preview(file, Formation.F352, MatchFormat.TWO_HALVES_30)).willReturn(new MatchImportPreview(List.of(), List.of()));
        mvc.perform(multipart("/api/v1/matches/import/preview").file(file).param("formation", "F352").param("matchFormat", "TWO_HALVES_30").with(csrf())).andExpect(status().isOk());
        org.mockito.Mockito.verify(service).preview(file, Formation.F352, MatchFormat.TWO_HALVES_30);
        mvc.perform(get("/api/v1/matches/import/template").param("matchFormat", "INVALID")).andExpect(status().isBadRequest());
    }
    @Test void selectedFormationIsPassedToBothTemplateAndPreview() throws Exception {
        given(service.template(Formation.F442)).willReturn(new byte[]{1});
        mvc.perform(get("/api/v1/matches/import/template").param("formation", "F442")).andExpect(status().isOk());
        org.mockito.Mockito.verify(service).template(Formation.F442);
        var file = new MockMultipartFile("file", "match.xlsx", "", new byte[]{1});
        given(service.preview(file, Formation.F4231)).willReturn(new MatchImportPreview(List.of(), List.of()));
        mvc.perform(multipart("/api/v1/matches/import/preview").file(file).param("formation", "F4231").with(csrf()))
                .andExpect(status().isOk());
        org.mockito.Mockito.verify(service).preview(file, Formation.F4231);
        mvc.perform(get("/api/v1/matches/import/template").param("formation", "F999")).andExpect(status().isBadRequest());
    }
    @Test void csrfRequiredAndAnonymousCannotDownload() throws Exception {
        mvc.perform(multipart("/api/v1/matches/import/preview").file(new MockMultipartFile("file", new byte[]{1}))).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @ParameterizedTest @EnumSource(value = Formation.class, names = {"F352", "F343"})
    void threeBackFormationFlowsToWorkbookTemplateAndPreview(Formation formation) throws Exception {
        given(service.template(formation)).willReturn(new byte[]{1});
        mvc.perform(get("/api/v1/matches/import/template").param("formation", formation.name())).andExpect(status().isOk());
        org.mockito.Mockito.verify(service).template(formation);
        var file = new MockMultipartFile("file", "match.xlsx", "", new byte[]{1});
        given(service.preview(file, formation)).willReturn(new MatchImportPreview(List.of(), List.of()));
        mvc.perform(multipart("/api/v1/matches/import/preview").file(file).param("formation", formation.name()).with(csrf()))
                .andExpect(status().isOk());
        org.mockito.Mockito.verify(service).preview(file, formation);
    }
    @Test @WithAnonymousUser void anonymousCannotDownload() throws Exception {
        mvc.perform(get("/api/v1/matches/import/template")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }
}
