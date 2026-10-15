package com.jochookon.stats;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.jochookon.team.TeamAccessException;
import com.jochookon.team.TeamContext;
import com.jochookon.match.CompetitionScope;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.CsvSource;

class PlayerStatsServiceTest {
    final PlayerStatsRepository repository = mock(PlayerStatsRepository.class);
    final PlayerStatsService service = new PlayerStatsService(repository,
            Clock.fixed(Instant.parse("2025-12-31T15:00:00Z"), ZoneOffset.UTC));
    @AfterEach void clearTeam() { TeamContext.clear(); }

    @Test void usesKoreanCalendarYearAndForwardsOnlyTheValidatedTeamScope() {
        TeamContext.set(27);
        var filter = new PlayerStatsFilter(2026, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, LocalDate.of(2026, 1, 1));
        when(repository.counts(27, filter)).thenReturn(new PlayerStatsRepository.MatchCounts(3, 3, 0, 0));
        when(repository.availableYears(27, filter)).thenReturn(List.of(2026, 2024));
        when(repository.players(27, filter)).thenReturn(List.of());
        var response = service.list(null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false);
        assertThat(response.year()).isEqualTo(2026);
        assertThat(response.allTime()).isFalse();
        assertThat(response.matchCount()).isEqualTo(3);
        assertThat(response.completedMatchCount()).isEqualTo(3);
        assertThat(response.availableYears()).containsExactly(2026, 2024);
        verify(repository).players(27, filter);
        verifyNoMoreInteractionsAfterExpectedCalls(filter);
    }
    private void verifyNoMoreInteractionsAfterExpectedCalls(PlayerStatsFilter filter) {
        verify(repository).counts(27, filter);
        verify(repository).availableYears(27, filter);
        verifyNoMoreInteractions(repository);
    }

    @Test void explicitScopeAndGuestOptionsArePreserved() {
        TeamContext.set(1);
        when(repository.counts(eq(1L), any())).thenReturn(new PlayerStatsRepository.MatchCounts(4, 1, 1, 2));
        when(repository.availableYears(eq(1L), any(PlayerStatsFilter.class))).thenReturn(List.of(2026, 2025));
        when(repository.players(eq(1L), any())).thenReturn(List.of());
        var response = service.list(2025, StatsMatchKind.ALL, StatsRecordScope.ALL, true);
        assertThat(response.kind()).isEqualTo(StatsMatchKind.ALL);
        assertThat(response.recordScope()).isEqualTo(StatsRecordScope.ALL);
        assertThat(response.includeGuests()).isTrue();
        assertThat(response.legacyMatchCount()).isEqualTo(1);
        assertThat(response.inProgressMatchCount()).isEqualTo(2);
        verify(repository).players(1, new PlayerStatsFilter(2025, StatsMatchKind.ALL, StatsRecordScope.ALL, true, LocalDate.of(2026, 1, 1)));
    }

    @Test void refusesRequestsWithoutValidatedTeamContextBeforeAnyQuery() {
        assertThatThrownBy(() -> service.list(null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false))
                .isInstanceOf(TeamAccessException.class);
        verifyNoInteractions(repository);
    }
    @ParameterizedTest @CsvSource({"TOURNAMENT,", "ALL,7", "TOURNAMENT,7"})
    void refusesInternalTournamentFiltersBeforeQueries(CompetitionScope scope, Long tournamentId) {
        TeamContext.set(1);
        assertThatThrownBy(() -> service.list(2026, StatsMatchKind.INTERNAL, StatsRecordScope.ALL, false, tournamentId, scope))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.matches(1, 2026, StatsMatchKind.INTERNAL, StatsRecordScope.ALL, false, 0, tournamentId, scope))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(repository);
    }
    @Test void refusesLeagueWithSpecificTournamentBeforeQueries() {
        TeamContext.set(1);
        assertThatThrownBy(() -> service.list(2026, StatsMatchKind.EXTERNAL, StatsRecordScope.ALL, false, 7L, CompetitionScope.LEAGUE))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.matches(1, 2026, StatsMatchKind.ALL, StatsRecordScope.ALL, false, 0, 7L, CompetitionScope.LEAGUE))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(repository);
    }
    @ParameterizedTest @org.junit.jupiter.params.provider.EnumSource(StatsMatchKind.class)
    void everySeasonQueryAndAvailableYearsUseTheSameCompetitionFilter(StatsMatchKind kind) {
        TeamContext.set(27);
        var filter = new PlayerStatsFilter(2026, kind, StatsRecordScope.RECORDED, false,
                LocalDate.of(2026, 1, 1), null, CompetitionScope.LEAGUE);
        when(repository.counts(27, filter)).thenReturn(new PlayerStatsRepository.MatchCounts(1, 1, 0, 0));
        when(repository.availableYears(27, filter)).thenReturn(List.of(2026));
        when(repository.players(27, filter)).thenReturn(List.of());
        var result = service.list(2026, kind, StatsRecordScope.RECORDED, false, null, CompetitionScope.LEAGUE);
        assertThat(result.competitionScope()).isEqualTo(CompetitionScope.LEAGUE);
        verify(repository).counts(27, filter); verify(repository).availableYears(27, filter); verify(repository).players(27, filter);
        verifyNoMoreInteractions(repository);
    }
    @Test void internalLeagueDetailsKeepTheRequestedYearAndReadScope() {
        TeamContext.set(27);
        var filter = new PlayerStatsFilter(2025, StatsMatchKind.INTERNAL, StatsRecordScope.COMPLETED, false,
                LocalDate.of(2026, 1, 1), null, CompetitionScope.LEAGUE);
        var player = new PlayerStatsResponse.Item(8, "가상 선수", 9, 2000, "MEMBER", true, "ST", 2, 1, 1, 1, 0.5);
        when(repository.player(27, filter, 8)).thenReturn(Optional.of(player));
        when(repository.contributingMatchCount(27, filter, 8)).thenReturn(1L);
        when(repository.contributingMatches(27, filter, 8, 10, 0)).thenReturn(List.of());
        var result = service.matches(8, 2025, StatsMatchKind.INTERNAL, StatsRecordScope.COMPLETED, false, 0, null, CompetitionScope.LEAGUE);
        assertThat(result.player()).isEqualTo(player);
        assertThat(result.year()).isEqualTo(2025);
        assertThat(result.kind()).isEqualTo(StatsMatchKind.INTERNAL);
        verify(repository).player(27, filter, 8);
        verify(repository).contributingMatchCount(27, filter, 8);
        verify(repository).contributingMatches(27, filter, 8, 10, 0);
        verifyNoMoreInteractions(repository);
    }
    @ParameterizedTest @ValueSource(ints = {-1, 0, 999, 10000, Integer.MAX_VALUE})
    void rejectsUnsupportedDatabaseYearsBeforeAnyQuery(int year) {
        TeamContext.set(1);
        assertThatThrownBy(() -> service.list(year, StatsMatchKind.ALL, StatsRecordScope.ALL, true))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(repository);
    }
    @Test void boundsIncludeBothYearEdgesAndNeverOverflow9999() {
        var today = LocalDate.of(2026, 10, 15);
        var previous = PlayerStatsFilter.of(2025, StatsMatchKind.ALL, StatsRecordScope.ALL, false, today);
        assertThat(previous.from()).isEqualTo(LocalDate.of(2025, 1, 1));
        assertThat(previous.through()).isEqualTo(LocalDate.of(2025, 12, 31));
        var current = PlayerStatsFilter.of(2026, StatsMatchKind.ALL, StatsRecordScope.ALL, false, today);
        assertThat(current.through()).isEqualTo(today);
        var distant = PlayerStatsFilter.of(9999, StatsMatchKind.ALL, StatsRecordScope.ALL, false, today);
        assertThat(distant.from()).isAfter(distant.through());
        assertThat(PlayerStatsFilter.of(1000, StatsMatchKind.ALL, StatsRecordScope.ALL, false, today).from())
                .isEqualTo(LocalDate.of(1000, 1, 1));
    }
    @Test void monthBoundsClampTodayAndEveryQueryReceivesTheSameMonth() {
        TeamContext.set(27);
        var filter = new PlayerStatsFilter(2024, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false,
                LocalDate.of(2026, 1, 1), null, CompetitionScope.ALL, 2);
        assertThat(filter.from()).isEqualTo(LocalDate.of(2024, 2, 1));
        assertThat(filter.through()).isEqualTo(LocalDate.of(2024, 2, 29));
        when(repository.counts(27, filter)).thenReturn(new PlayerStatsRepository.MatchCounts(0, 0, 0, 0));
        when(repository.availableYears(27, filter)).thenReturn(List.of(2026, 2025, 2024));
        when(repository.players(27, filter)).thenReturn(List.of());
        var response = service.list(2024, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, 2);
        assertThat(response.month()).isEqualTo(2);
        verify(repository).counts(27, filter); verify(repository).players(27, filter); verify(repository).availableYears(27, filter);
        var future = PlayerStatsFilter.of(null, StatsMatchKind.ALL, StatsRecordScope.ALL, false,
                LocalDate.of(2026, 1, 15), null, CompetitionScope.ALL, 2);
        assertThat(future.year()).isEqualTo(2026);
        assertThat(future.from()).isAfter(future.through());
        assertThat(PlayerStatsFilter.of(2026, StatsMatchKind.ALL, StatsRecordScope.ALL, false,
                LocalDate.of(2026, 1, 15), null, CompetitionScope.ALL, 1).through()).isEqualTo(LocalDate.of(2026, 1, 15));
    }
    @Test void rangeQueriesKeepTheSameBoundsAndSummaryMetadataAcrossYears() {
        TeamContext.set(27);
        var filter = PlayerStatsFilter.of(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false,
                LocalDate.of(2026, 1, 1), null, CompetitionScope.ALL, null, "2023-12", "2024-02");
        assertThat(filter.year()).isEqualTo(2023);
        assertThat(filter.from()).isEqualTo(LocalDate.of(2023, 12, 1));
        assertThat(filter.through()).isEqualTo(LocalDate.of(2024, 2, 29));
        when(repository.counts(27, filter)).thenReturn(new PlayerStatsRepository.MatchCounts(0, 0, 0, 0));
        when(repository.players(27, filter)).thenReturn(List.of());
        when(repository.availableYears(27, filter)).thenReturn(List.of(2026, 2024, 2023));
        var response = service.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, null, "2023-12", "2024-02");
        assertThat(response.year()).isEqualTo(2023); assertThat(response.month()).isNull();
        assertThat(response.startMonth()).isEqualTo("2023-12"); assertThat(response.endMonth()).isEqualTo("2024-02");
        verify(repository).counts(27, filter); verify(repository).players(27, filter); verify(repository).availableYears(27, filter);
        var future = PlayerStatsFilter.of(null, StatsMatchKind.ALL, StatsRecordScope.ALL, false,
                LocalDate.of(2026, 1, 15), null, CompetitionScope.ALL, null, "2025-12", "9999-12");
        assertThat(future.through()).isEqualTo(LocalDate.of(2026, 1, 15));
        assertThatThrownBy(() -> service.list(2023, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, null, "2023-12", "2024-02"))
                .isInstanceOf(IllegalArgumentException.class);
    }
    @Test void allTimeUsesFullStoredDateRangeAndTheSameFilterForSummaryDetailsAndYearChoices() {
        TeamContext.set(27);
        var filter = PlayerStatsFilter.of(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false,
                LocalDate.of(2026, 1, 1), null, CompetitionScope.ALL, null, null, null, true);
        assertThat(filter.from()).isEqualTo(LocalDate.of(1000, 1, 1));
        assertThat(filter.through()).isEqualTo(LocalDate.of(2026, 1, 1));
        var player = new PlayerStatsResponse.Item(8, "가상 선수", 9, 2000, "MEMBER", true, "ST", 6, 2, 3, 3, 2.5);
        when(repository.counts(27, filter)).thenReturn(new PlayerStatsRepository.MatchCounts(3, 3, 0, 0));
        when(repository.players(27, filter)).thenReturn(List.of(player));
        when(repository.availableYears(27, filter)).thenReturn(List.of(2026, 2024, 1000));
        when(repository.player(27, filter, 8)).thenReturn(Optional.of(player));
        when(repository.contributingMatchCount(27, filter, 8)).thenReturn(3L);
        when(repository.contributingMatches(27, filter, 8, 10, 0)).thenReturn(List.of());
        var list = service.list(null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, null, null, null, true);
        var detail = service.matches(8, null, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, 0, null, CompetitionScope.ALL, null, null, null, true);
        assertThat(list.allTime()).isTrue(); assertThat(detail.allTime()).isTrue();
        assertThat(list.year()).isEqualTo(2026); assertThat(list.month()).isNull(); assertThat(list.startMonth()).isNull(); assertThat(list.endMonth()).isNull();
        assertThat(detail.player()).isEqualTo(list.items().getFirst());
        assertThat(list.availableYears()).containsExactly(2026, 2024, 1000);
        verify(repository).counts(27, filter); verify(repository).players(27, filter); verify(repository).availableYears(27, filter);
        verify(repository).player(27, filter, 8); verify(repository).contributingMatchCount(27, filter, 8); verify(repository).contributingMatches(27, filter, 8, 10, 0);
        verifyNoMoreInteractions(repository);
    }
    @ParameterizedTest @CsvSource({"2026,,,", ",3,,", ",,2026-03,", ",,,2026-06", ",,2026-03,2026-06"})
    void allTimeRejectsDateFieldsBeforeAnyQuery(Integer year, Integer month, String startMonth, String endMonth) {
        TeamContext.set(27);
        assertThatThrownBy(() -> service.list(year, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, null, CompetitionScope.ALL, month, startMonth, endMonth, true))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.matches(8, year, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false, 0, null, CompetitionScope.ALL, month, startMonth, endMonth, true))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(repository);
    }
    @Test void teamConcededGoalsAndCoverageUseTheSameSelectedMatchesAsCounts() {
        TeamContext.set(27);
        var filter = new PlayerStatsFilter(2025, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, true,
                LocalDate.of(2026, 1, 1), null, CompetitionScope.ALL);
        when(repository.counts(27, filter)).thenReturn(new PlayerStatsRepository.MatchCounts(5, 5, 0, 0, 2L, 2, 1, 2));
        when(repository.availableYears(27, filter)).thenReturn(List.of(2026, 2025));
        when(repository.players(27, filter)).thenReturn(List.of());
        var response = service.list(2025, StatsMatchKind.ALL, StatsRecordScope.COMPLETED, true);
        assertThat(response.goalsAgainst()).isEqualTo(2);
        assertThat(response.scoredExternalMatchCount()).isEqualTo(2);
        assertThat(response.missingExternalScoreCount()).isEqualTo(1);
        assertThat(response.excludedInternalMatchCount()).isEqualTo(2);
        assertThat(response.externalMatchCount()).isEqualTo(3);
        assertThat(response.internalMatchCount()).isEqualTo(2);
        assertThat(response.matchCount()).isEqualTo(response.externalMatchCount() + response.internalMatchCount());
        verify(repository).counts(27, filter);
    }

    @Test void matchDetailsKeepFullSeasonSummaryAndUseFixedTenItemPagesWithKoreanYear() {
        TeamContext.set(27);
        var filter = new PlayerStatsFilter(2026, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, LocalDate.of(2026, 1, 1));
        var player = new PlayerStatsResponse.Item(8, "가상 선수", 9, 2000, "MEMBER", true, "ST", 40, 5, 21, 21, 75.5);
        when(repository.player(27, filter, 8)).thenReturn(Optional.of(player));
        when(repository.contributingMatchCount(27, filter, 8)).thenReturn(21L);
        when(repository.contributingMatches(27, filter, 8, 10, 20)).thenReturn(List.of());
        var response = service.matches(8, null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 2);
        assertThat(response.year()).isEqualTo(2026);
        assertThat(response.player()).isEqualTo(player);
        assertThat(response.page()).isEqualTo(2);
        assertThat(response.size()).isEqualTo(10);
        assertThat(response.totalElements()).isEqualTo(21);
        assertThat(response.totalPages()).isEqualTo(3);
        verify(repository).player(27, filter, 8);
        verify(repository).contributingMatchCount(27, filter, 8);
        verify(repository).contributingMatches(27, filter, 8, 10, 20);
        verifyNoMoreInteractions(repository);
    }

    @Test void outOfRangePageKeepsSummaryAndUsesAnOverflowSafeOffset() {
        TeamContext.set(1);
        var filter = new PlayerStatsFilter(2025, StatsMatchKind.ALL, StatsRecordScope.RECORDED, true, LocalDate.of(2026, 1, 1));
        var player = new PlayerStatsResponse.Item(8, "가상 선수", 9, 2000, "MEMBER", true, "ST", 0, 0, 0, 0, 0);
        when(repository.player(1, filter, 8)).thenReturn(Optional.of(player));
        when(repository.contributingMatches(1, filter, 8, 10, 21474836470L)).thenReturn(List.of());
        var response = service.matches(8, 2025, StatsMatchKind.ALL, StatsRecordScope.RECORDED, true, Integer.MAX_VALUE);
        assertThat(response.kind()).isEqualTo(StatsMatchKind.ALL);
        assertThat(response.recordScope()).isEqualTo(StatsRecordScope.RECORDED);
        assertThat(response.includeGuests()).isTrue();
        assertThat(response.player()).isEqualTo(player);
        assertThat(response.totalElements()).isZero();
        assertThat(response.totalPages()).isZero();
        assertThat(response.items()).isEmpty();
        verify(repository).contributingMatches(1, filter, 8, 10, 21474836470L);
    }

    @Test void playerNotInTheFilteredSeasonHasOneUniformNotFoundAndNoMatchLookup() {
        TeamContext.set(1);
        when(repository.player(eq(1L), any(), eq(8L))).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.matches(8, 2025, StatsMatchKind.ALL, StatsRecordScope.RECORDED, true, 0))
                .isInstanceOf(PlayerStatsNotFoundException.class).hasMessage("현재 조건에서 선수 기록을 찾을 수 없습니다.");
        verify(repository).player(eq(1L), any(), eq(8L));
        verifyNoMoreInteractions(repository);
    }

    @ParameterizedTest @CsvSource({"0,0", "-1,0", "1,-1", "1,-2147483648"})
    void invalidPlayerOrPageIsRejectedBeforeQueries(long playerId, int page) {
        TeamContext.set(1);
        assertThatThrownBy(() -> service.matches(playerId, null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, page))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(repository);
    }

    @Test void matchDetailsRequireTeamContextAndValidYearBeforeQueries() {
        assertThatThrownBy(() -> service.matches(1, null, StatsMatchKind.ALL, StatsRecordScope.ALL, true, 0))
                .isInstanceOf(TeamAccessException.class);
        TeamContext.set(1);
        assertThatThrownBy(() -> service.matches(1, 10000, StatsMatchKind.ALL, StatsRecordScope.ALL, true, 0))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(repository);
    }
}
