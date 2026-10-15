package com.jochookon.stats;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jochookon.auth.AccountUserDetailsService;
import com.jochookon.config.SecurityConfig;
import com.jochookon.match.CompetitionScope;
import com.jochookon.team.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.Authentication;
import org.springframework.security.test.context.support.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(PlayerStatsController.class) @Import(SecurityConfig.class) @WithMockUser(roles = "MEMBER")
class PlayerStatsControllerTest extends TeamMvcTestSupport {
    @Autowired MockMvc mvc;
    @MockitoBean PlayerStatsService service;
    @MockitoBean AccountUserDetailsService userDetailsService;
    final String path = "/api/v1/stats/players";
    final String detailPath = path + "/8/matches";

    @ParameterizedTest @ValueSource(strings = {"MEMBER", "COACH", "DIRECTOR"})
    void membersAndStaffCanReadWithSafeDefaults(String role) throws Exception {
        given(service.list(null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false)).willReturn(empty());
        mvc.perform(get(path).header("X-Team-Id", "1").with(user("reader").roles(role)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.kind").value("EXTERNAL"))
                .andExpect(jsonPath("$.recordScope").value("COMPLETED"))
                .andExpect(jsonPath("$.includeGuests").value(false)).andExpect(jsonPath("$.allTime").value(false)).andExpect(jsonPath("$.items").isEmpty());
        verify(service).list(null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false);
    }
    @Test void allRequestedFiltersAreForwarded() throws Exception {
        mvc.perform(get(path + "?year=2025&kind=INTERNAL&recordScope=RECORDED&includeGuests=true").header("X-Team-Id", "1"))
                .andExpect(status().isOk());
        verify(service).list(2025, StatsMatchKind.INTERNAL, StatsRecordScope.RECORDED, true);
    }
    @Test void tournamentFilterIsForwardedToBothSeasonAndPlayerDetail() throws Exception {
        mvc.perform(get(path + "?tournamentId=9").header("X-Team-Id", "1")).andExpect(status().isOk());
        verify(service).list(null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 9L);
        mvc.perform(get(detailPath + "?tournamentId=9&page=2").header("X-Team-Id", "1")).andExpect(status().isOk());
        verify(service).matches(8, null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 2, 9L);
        mvc.perform(get(path + "?tournamentId=0").header("X-Team-Id", "1")).andExpect(status().isBadRequest());
        mvc.perform(get(detailPath + "?tournamentId=-1").header("X-Team-Id", "1")).andExpect(status().isBadRequest());
    }
    @Test void competitionFilterIsForwardedForListAndDetails() throws Exception {
        mvc.perform(get(path + "?competitionScope=LEAGUE&kind=ALL").header("X-Team-Id", "1")).andExpect(status().isOk());
        verify(service).list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.LEAGUE);
        mvc.perform(get(detailPath + "?competitionScope=TOURNAMENT&tournamentId=9").header("X-Team-Id", "1")).andExpect(status().isOk());
        verify(service).matches(8, null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0, 9L, CompetitionScope.TOURNAMENT);
    }
    @ParameterizedTest @ValueSource(strings = {"competitionScope=INVALID", "competitionScope=LEAGUE&tournamentId=9",
            "kind=INTERNAL&tournamentId=9", "competitionScope=TOURNAMENT&kind=INTERNAL"})
    void inconsistentCompetitionFiltersFailForBothEndpoints(String query) throws Exception {
        mvc.perform(get(path + "?" + query).header("X-Team-Id", "1")).andExpect(status().isBadRequest());
        mvc.perform(get(detailPath + "?" + query).header("X-Team-Id", "1")).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void internalLeagueIsValidForSeasonAndPlayerFilters() throws Exception {
        mvc.perform(get(path + "?year=2025&competitionScope=LEAGUE&kind=INTERNAL").header("X-Team-Id", "1"))
                .andExpect(status().isOk());
        verify(service).list(2025, StatsMatchKind.INTERNAL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.LEAGUE);
        mvc.perform(get(detailPath + "?year=2025&competitionScope=LEAGUE&kind=INTERNAL&page=1").header("X-Team-Id", "1"))
                .andExpect(status().isOk());
        verify(service).matches(8, 2025, StatsMatchKind.INTERNAL, StatsRecordScope.COMPLETED, false, 1, null, CompetitionScope.LEAGUE);
    }
    @ParameterizedTest @ValueSource(strings = {"year=999", "year=10000", "year=abc", "kind=UNKNOWN",
            "recordScope=LEGACY", "includeGuests=perhaps", "month=0", "month=13", "month=abc"})
    void rejectsMalformedAndOutOfRangeFilters(String query) throws Exception {
        mvc.perform(get(path + "?" + query).header("X-Team-Id", "1"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        verifyNoInteractions(service);
    }
    @Test void monthIsForwardedToBothEndpointsAndAllowsDefaultYear() throws Exception {
        mvc.perform(get(path + "?year=2024&month=2&kind=ALL&competitionScope=LEAGUE").header("X-Team-Id", "1"))
                .andExpect(status().isOk());
        verify(service).list(2024, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.LEAGUE, 2);
        mvc.perform(get(detailPath + "?month=2&kind=ALL").header("X-Team-Id", "1")).andExpect(status().isOk());
        verify(service).matches(8, null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, 0, null, CompetitionScope.ALL, 2);
    }
    @Test void monthRangeIsForwardedToBothEndpointsWithoutLegacyFilters() throws Exception {
        String query = "?startMonth=2023-12&endMonth=2024-02&kind=ALL&competitionScope=LEAGUE";
        mvc.perform(get(path + query).header("X-Team-Id", "1")).andExpect(status().isOk());
        verify(service).list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.LEAGUE, null, "2023-12", "2024-02");
        mvc.perform(get(detailPath + query).header("X-Team-Id", "1")).andExpect(status().isOk());
        verify(service).matches(8, null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, 0, null, CompetitionScope.LEAGUE, null, "2023-12", "2024-02");
    }
    @Test void allTimeForwardsExistingFiltersToSeasonAndPersonalDetails() throws Exception {
        mvc.perform(get(path + "?allTime=true&kind=ALL&recordScope=RECORDED&includeGuests=true&competitionScope=LEAGUE").header("X-Team-Id", "1"))
                .andExpect(status().isOk());
        verify(service).list(null, StatsMatchKind.ALL, StatsRecordScope.RECORDED, true, null, CompetitionScope.LEAGUE, null, null, null, true);
        mvc.perform(get(detailPath + "?allTime=true&kind=ALL&competitionScope=TOURNAMENT&tournamentId=9&page=1").header("X-Team-Id", "1"))
                .andExpect(status().isOk());
        verify(service).matches(8, null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, 1, 9L, CompetitionScope.TOURNAMENT, null, null, null, true);
    }
    @ParameterizedTest @ValueSource(strings = {"allTime=true&year=2026", "allTime=true&month=3", "allTime=true&startMonth=2026-03",
            "allTime=true&endMonth=2026-06", "allTime=true&startMonth=2026-03&endMonth=2026-06", "allTime=unknown"})
    void allTimeCannotBeMixedWithDateSelection(String query) throws Exception {
        mvc.perform(get(path + "?" + query).header("X-Team-Id", "1")).andExpect(status().isBadRequest());
        mvc.perform(get(detailPath + "?" + query).header("X-Team-Id", "1")).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void explicitFalseKeepsDefaultCurrentYearDispatch() throws Exception {
        mvc.perform(get(path + "?allTime=false").header("X-Team-Id", "1")).andExpect(status().isOk());
        verify(service).list(null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false);
    }
    @ParameterizedTest @ValueSource(strings = {"startMonth=2026-03", "endMonth=2026-06", "startMonth=2026-06&endMonth=2026-03",
            "startMonth=2026-3&endMonth=2026-06", "startMonth=2026-03&endMonth=2026-06&year=2026", "startMonth=2026-03&endMonth=2026-06&month=3"})
    void invalidMonthRangesNeverReachStatsQueries(String query) throws Exception {
        mvc.perform(get(path + "?" + query).header("X-Team-Id", "1")).andExpect(status().isBadRequest());
        mvc.perform(get(detailPath + "?" + query).header("X-Team-Id", "1")).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test @WithAnonymousUser void anonymousAccessIsRejected() throws Exception {
        mvc.perform(get(path).header("X-Team-Id", "1")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }
    @Test void missingOrChangedTeamIsRejectedBeforeTheService() throws Exception {
        mvc.perform(get(path)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_CHANGED"));
        mvc.perform(get(path).header("X-Team-Id", "2")).andExpect(status().isConflict());
        verifyNoInteractions(service);
    }
    @Test void teamCodeSessionsAreAllowedButCannotWrite() throws Exception {
        given(teamSessions.inspect(nullable(Authentication.class), any(HttpServletRequest.class)))
                .willReturn(new TeamSessionService.Access(new TeamDtos.CurrentUser(null, "MEMBER", "TEAM_CODE", false,
                        new TeamDtos.Team(1L, "검증 팀", "", "ACTIVE"), List.of()), null));
        given(service.list(null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false)).willReturn(empty());
        mvc.perform(get(path).header("X-Team-Id", "1")).andExpect(status().isOk());
        mvc.perform(post(path).header("X-Team-Id", "1").with(csrf())).andExpect(status().isForbidden());
    }
    @Test void anAccountWithNoSelectedTeamCannotReadStats() throws Exception {
        given(teamSessions.inspect(nullable(Authentication.class), any(HttpServletRequest.class)))
                .willReturn(new TeamSessionService.Access(new TeamDtos.CurrentUser("owner", "MEMBER", "ACCOUNT", true,
                        null, List.of()), 1L));
        mvc.perform(get(path).header("X-Team-Id", "1")).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("TEAM_REQUIRED"));
        verifyNoInteractions(service);
    }
    private PlayerStatsResponse empty() {
        return new PlayerStatsResponse(2026, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false,
                List.of(2026), 0, 0, 0, 0, List.of());
    }

    @ParameterizedTest @ValueSource(strings = {"MEMBER", "COACH", "DIRECTOR"})
    void membersAndStaffCanReadMatchDetailsAndAllResponseFields(String role) throws Exception {
        given(service.matches(8, null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0)).willReturn(detail());
        mvc.perform(get(detailPath).header("X-Team-Id", "1").with(user("reader").roles(role)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.year").value(2026))
                .andExpect(jsonPath("$.kind").value("EXTERNAL"))
                .andExpect(jsonPath("$.recordScope").value("COMPLETED"))
                .andExpect(jsonPath("$.includeGuests").value(false))
                .andExpect(jsonPath("$.player.playerId").value(8)).andExpect(jsonPath("$.player.goals").value(9))
                .andExpect(jsonPath("$.page").value(0)).andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.items[0].matchId").value(21))
                .andExpect(jsonPath("$.items[0].playedOn").value("2026-01-01"))
                .andExpect(jsonPath("$.items[0].kickoff").value("11:30:00"))
                .andExpect(jsonPath("$.items[0].opponent").value("가상 상대"))
                .andExpect(jsonPath("$.items[0].venue").value("가상 구장"))
                .andExpect(jsonPath("$.items[0].kind").value("EXTERNAL"))
                .andExpect(jsonPath("$.items[0].recordingStage").value("COMPLETED"))
                .andExpect(jsonPath("$.items[0].scoreFor").value(2)).andExpect(jsonPath("$.items[0].scoreAgainst").value(1))
                .andExpect(jsonPath("$.items[0].goals").value(1)).andExpect(jsonPath("$.items[0].assists").value(2))
                .andExpect(jsonPath("$.items[0].creditedQuarters").value(0.5))
                .andExpect(jsonPath("$.items[0].appeared").value(true)).andExpect(jsonPath("$.items[0].attendance").value("LATE"));
        verify(service).matches(8, null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0);
    }

    @Test void matchDetailFiltersAndPageAreForwardedAndSizeCannotBeOverridden() throws Exception {
        mvc.perform(get(detailPath + "?year=2025&kind=INTERNAL&recordScope=RECORDED&includeGuests=true&page=2&size=1000")
                .header("X-Team-Id", "1")).andExpect(status().isOk());
        verify(service).matches(8, 2025, StatsMatchKind.INTERNAL, StatsRecordScope.RECORDED, true, 2);
    }

    @ParameterizedTest @ValueSource(strings = {"/0/matches", "/-1/matches", "/invalid/matches", "/8/matches?page=-1",
            "/8/matches?page=2147483648", "/8/matches?page=abc", "/8/matches?year=999", "/8/matches?year=10000",
            "/8/matches?kind=UNKNOWN", "/8/matches?recordScope=LEGACY", "/8/matches?includeGuests=perhaps"})
    void rejectsMalformedDetailIdsAndFilters(String suffix) throws Exception {
        mvc.perform(get(path + suffix).header("X-Team-Id", "1"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        verifyNoInteractions(service);
    }

    @Test void missingOrExcludedPlayerReturnsTheSame404() throws Exception {
        given(service.matches(8, null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0))
                .willThrow(new PlayerStatsNotFoundException());
        mvc.perform(get(detailPath).header("X-Team-Id", "1"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("PLAYER_STATS_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("현재 조건에서 선수 기록을 찾을 수 없습니다."));
    }

    @Test @WithAnonymousUser void anonymousMatchDetailsAreRejected() throws Exception {
        mvc.perform(get(detailPath).header("X-Team-Id", "1")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test void matchDetailRequestsCannotOmitOrChangeSelectedTeam() throws Exception {
        mvc.perform(get(detailPath)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_CHANGED"));
        mvc.perform(get(detailPath).header("X-Team-Id", "2")).andExpect(status().isConflict());
        verifyNoInteractions(service);
    }

    @Test void codeSessionsCanReadMatchDetailsButCannotWrite() throws Exception {
        given(teamSessions.inspect(nullable(Authentication.class), any(HttpServletRequest.class)))
                .willReturn(new TeamSessionService.Access(new TeamDtos.CurrentUser(null, "MEMBER", "TEAM_CODE", false,
                        new TeamDtos.Team(1L, "검증 팀", "", "ACTIVE"), List.of()), null));
        given(service.matches(8, null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0)).willReturn(detail());
        mvc.perform(get(detailPath).header("X-Team-Id", "1")).andExpect(status().isOk());
        mvc.perform(post(detailPath).header("X-Team-Id", "1").with(csrf())).andExpect(status().isForbidden());
        verify(service, times(1)).matches(8, null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0);
    }

    @Test void serviceAdministratorWithoutSelectedTeamCannotReadMatchDetails() throws Exception {
        given(teamSessions.inspect(nullable(Authentication.class), any(HttpServletRequest.class)))
                .willReturn(new TeamSessionService.Access(new TeamDtos.CurrentUser("owner", "MEMBER", "ACCOUNT", true,
                        null, List.of()), 1L));
        mvc.perform(get(detailPath).header("X-Team-Id", "1")).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("TEAM_REQUIRED"));
        verifyNoInteractions(service);
    }

    private PlayerMatchStatsResponse detail() {
        var player = new PlayerStatsResponse.Item(8, "가상 선수", 9, 2000, "MEMBER", true, "ST", 9, 4, 3, 3, 7.5);
        var match = new PlayerMatchStatsResponse.Item(21, LocalDate.of(2026, 1, 1), LocalTime.of(11, 30),
                "가상 상대", "가상 구장", "EXTERNAL", "COMPLETED", 2, 1, 1, 2, 0.5, true, "LATE");
        return new PlayerMatchStatsResponse(2026, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false,
                player, 0, 10, 1, 1, List.of(match));
    }
}
