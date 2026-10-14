package com.hanafc.player;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hanafc.config.SecurityConfig;
import com.hanafc.auth.AccountUserDetailsService;
import java.util.List;
import java.time.LocalDate;
import org.springframework.http.MediaType;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.security.test.context.support.WithAnonymousUser;

@WebMvcTest(PlayerController.class)
@Import(SecurityConfig.class)
@WithMockUser(roles = "MEMBER")
class PlayerControllerTest {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    PlayerQueryService playerQueryService;

    @MockitoBean
    PlayerCommandService playerCommandService;

    @MockitoBean
    AccountUserDetailsService userDetailsService;

    @Test
    void returnsAnEmptyPageWhenNoPlayersAreRegistered() throws Exception {
        given(playerQueryService.findActivePlayers(0, 20, "id", "asc"))
                .willReturn(new PlayerPageResponse(List.of(), 0, 20, 0, 0));
        mvc.perform(get("/api/v1/players"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"page=-1", "size=0", "size=101", "page=abc", "sort=password", "direction=sideways"})
    void rejectsInvalidPagingBeforeReachingTheDatabase(String query) throws Exception {
        mvc.perform(get("/api/v1/players?" + query)).andExpect(status().isBadRequest());
        verifyNoInteractions(playerQueryService);
    }

    @Test
    void deniesMutationEvenWithAValidCsrfToken() throws Exception {
        mvc.perform(post("/api/v1/players").with(csrf())).andExpect(status().isForbidden());
        verifyNoInteractions(playerQueryService);
    }

    @Test
    void deniesUnlistedApiRoutes() throws Exception {
        mvc.perform(get("/api/v1/admin")).andExpect(status().isForbidden());
    }

    @Test
    @WithAnonymousUser
    void requiresLoginBeforeReadingPlayerData() throws Exception {
        mvc.perform(get("/api/v1/players")).andExpect(status().isUnauthorized());
        verifyNoInteractions(playerQueryService);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void createsPlayerWithTrimmedNameAndOptionalFields() throws Exception {
        given(playerCommandService.create(new CreatePlayerRequest("테스트 선수", null, Position.MF, null, PreferredPosition.CM, null, null, null, null)))
                .willReturn(new PlayerResponse(5L, "테스트 선수", null, Position.MF, null, 0L, PreferredPosition.CM, null, null, null, null, PlayerType.MEMBER));
        mvc.perform(post("/api/v1/players").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"  테스트 선수  ","position":"MF","firstChoice":"CM"}
                                """))
                .andExpect(status().isCreated()).andExpect(header().string("Location", "/api/v1/players/5"))
                .andExpect(jsonPath("$.name").value("테스트 선수"))
                .andExpect(jsonPath("$.shirtNumber").isEmpty()).andExpect(jsonPath("$.joinedOn").isEmpty())
                .andExpect(jsonPath("$.version").value(0));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void updatesPlayerAndReturnsNewVersion() throws Exception {
        given(playerCommandService.update(5, new UpdatePlayerRequest("수정 선수", 1, Position.GK, LocalDate.of(2026, 10, 13), 0L, PreferredPosition.CM, null, null, null, null)))
                .willReturn(new PlayerResponse(5L, "수정 선수", 1, Position.GK, LocalDate.of(2026, 10, 13), 1L, PreferredPosition.CM, null, null, null, null, PlayerType.MEMBER));
        mvc.perform(put("/api/v1/players/5").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"수정 선수","shirtNumber":1,"position":"GK","firstChoice":"CM","joinedOn":"2026-10-13","version":0}
                                """))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.joinedOn").value("2026-10-13"));
    }

    @ParameterizedTest
    @WithMockUser(roles = "ADMIN")
    @ValueSource(strings = {
        "{\"name\":\"  \",\"position\":\"GK\"}",
        "{\"name\":\"선수\"}",
        "{\"name\":\"선수\",\"position\":\"LB\"}",
        "{\"name\":\"선수\",\"position\":\"UN\",\"shirtNumber\":0}",
        "{\"name\":\"선수\",\"position\":\"GK\",\"shirtNumber\":100}",
        "{\"name\":\"선수\",\"position\":\"GK\",\"shirtNumber\":-1}",
        "{\"name\":\"선수\",\"position\":\"GK\",\"shirtNumber\":1.5}",
        "{\"name\":\"선수\",\"position\":1}",
        "{\"name\":\"선수\",\"position\":\"GK\",\"joinedOn\":\"not-a-date\"}"
    })
    void rejectsInvalidCreationBeforeReachingDatabase(String body) throws Exception {
        mvc.perform(post("/api/v1/players").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").exists());
        verifyNoInteractions(playerCommandService);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void requiresVersionForUpdates() throws Exception {
        mvc.perform(put("/api/v1/players/5").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"선수","position":"GK","firstChoice":"CM"}
                                """))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.version").exists());
        verifyNoInteractions(playerCommandService);
    }

    @Test
    void memberCannotUpdateEvenWithCsrfToken() throws Exception {
        mvc.perform(put("/api/v1/players/5").with(csrf())).andExpect(status().isForbidden());
        verifyNoInteractions(playerCommandService);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminStillNeedsCsrfToken() throws Exception {
        mvc.perform(post("/api/v1/players")).andExpect(status().isForbidden());
        verifyNoInteractions(playerCommandService);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void returnsConflictInsteadOfOverwritingAnotherEdit() throws Exception {
        given(playerCommandService.update(5, new UpdatePlayerRequest("선수", null, Position.GK, null, 0L, PreferredPosition.CM, null, null, null, null)))
                .willThrow(new ObjectOptimisticLockingFailureException(Player.class, 5L));
        mvc.perform(put("/api/v1/players/5").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"선수","position":"GK","firstChoice":"CM","version":0}
                                """))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PLAYER_CONFLICT"));
    }

    @Test
    void memberCanReadDetailsAndUnknownPlayerReturns404() throws Exception {
        given(playerQueryService.findActivePlayer(5)).willReturn(new PlayerResponse(5L, "선수", 7, Position.FW, null, 1L, PreferredPosition.CM, null, null, null, null, PlayerType.MEMBER));
        given(playerQueryService.findActivePlayer(6)).willThrow(new PlayerNotFoundException());
        mvc.perform(get("/api/v1/players/5")).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
        mvc.perform(get("/api/v1/players/6")).andExpect(status().isNotFound());
    }

    @Test @WithMockUser(roles = "ADMIN")
    void databaseRaceReportsTheShirtFieldWithoutExposingSql() throws Exception {
        given(playerCommandService.create(org.mockito.ArgumentMatchers.any())).willThrow(
                new org.springframework.dao.DataIntegrityViolationException("save failed",
                        new java.sql.SQLIntegrityConstraintViolationException("Duplicate entry for key players.uq_players_active_shirt")));
        mvc.perform(post("/api/v1/players").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                {"name":"동시 저장 선수","position":"UN","shirtNumber":7}
                """ )).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("DUPLICATE_SHIRT_NUMBER"))
                .andExpect(jsonPath("$.fieldErrors.shirtNumber").isNotEmpty());
    }
}
