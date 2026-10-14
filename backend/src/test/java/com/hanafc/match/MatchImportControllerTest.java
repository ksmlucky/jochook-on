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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(MatchImportController.class) @Import(SecurityConfig.class) @WithMockUser(roles = "ADMIN")
class MatchImportControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean MatchWorkbookService service;
    @MockitoBean AccountUserDetailsService users;
    @Test void adminDownloadsTemplateAndPreviewsMultipart() throws Exception {
        given(service.template()).willReturn(new byte[]{1,2,3});
        mvc.perform(get("/api/v1/matches/import/template")).andExpect(status().isOk()).andExpect(header().string("Content-Disposition", "attachment; filename=hana-fc-match.xlsx"));
        var file = new MockMultipartFile("file", "match.xlsx", "", new byte[]{1});
        given(service.preview(file)).willReturn(new MatchImportPreview(List.of(), List.of()));
        mvc.perform(multipart("/api/v1/matches/import/preview").file(file).with(csrf())).andExpect(status().isOk()).andExpect(jsonPath("$.valid").value(false));
    }
    @Test @WithMockUser(roles = "MEMBER") void memberCannotImportEvenWithCsrf() throws Exception {
        mvc.perform(get("/api/v1/matches/import/template")).andExpect(status().isForbidden());
        mvc.perform(multipart("/api/v1/matches/import/preview").file(new MockMultipartFile("file", new byte[]{1})).with(csrf())).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @Test void csrfRequiredAndAnonymousCannotDownload() throws Exception {
        mvc.perform(multipart("/api/v1/matches/import/preview").file(new MockMultipartFile("file", new byte[]{1}))).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @Test @WithAnonymousUser void anonymousCannotDownload() throws Exception {
        mvc.perform(get("/api/v1/matches/import/template")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }
}
