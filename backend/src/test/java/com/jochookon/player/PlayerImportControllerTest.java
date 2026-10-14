package com.jochookon.player;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static com.jochookon.player.TeamScopedRequests.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.jochookon.auth.AccountUserDetailsService;
import com.jochookon.config.SecurityConfig;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(PlayerImportController.class)
@Import(SecurityConfig.class)
@WithMockUser(roles = "DIRECTOR")
class PlayerImportControllerTest extends com.jochookon.team.TeamMvcTestSupport {
    @Autowired MockMvc mvc;
    @MockitoBean BulkPlayerService bulk;
    @MockitoBean PlayerWorkbookService workbooks;
    @MockitoBean AccountUserDetailsService accounts;
    @Test void previewReturnsValidationStateWithoutSaving() throws Exception {
        when(bulk.preview(any(), isNull())).thenReturn(new PlayerImportPreview(List.of(new PlayerImportPreview.Row(1,
                BulkPlayerServiceTest.row("선수", "CM", "", ""), List.of(), List.of()))));
        mvc.perform(post("/api/v1/players/bulk/preview").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"rows":[{"name":"선수","position":"MF","firstChoice":"CM"}]}
                """))
                .andExpect(status().isOk()).andExpect(jsonPath("$.valid").value(true));
        verify(bulk, never()).create(any());
    }
    @Test void rejectsEmptyBatch() throws Exception {
        mvc.perform(post("/api/v1/players/bulk").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"rows\":[]}"))
                .andExpect(status().isBadRequest()); verifyNoInteractions(bulk);
    }
    @Test @WithMockUser(roles = "MEMBER") void membersCannotPreviewDownloadOrSave() throws Exception {
        mvc.perform(get("/api/v1/players/import/template")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/players/import/preview").with(csrf())).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/players/bulk/preview").with(csrf())).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/players/bulk").with(csrf())).andExpect(status().isForbidden());
        verifyNoInteractions(bulk, workbooks);
    }
    @Test void requiresCsrfForBulkAndWorkbookUploads() throws Exception {
        mvc.perform(post("/api/v1/players/bulk")).andExpect(status().isForbidden());
        mvc.perform(multipart("/api/v1/players/import/preview").file("file", new byte[]{1})).andExpect(status().isForbidden());
    }
}
