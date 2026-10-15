package com.jochookon.stats;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.jochookon.team.TeamAccessException;
import com.jochookon.team.TeamContext;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class PlayerStatsServiceTest {
    final PlayerStatsRepository repository = mock(PlayerStatsRepository.class);
    final PlayerStatsService service = new PlayerStatsService(repository,
            Clock.fixed(Instant.parse("2025-12-31T15:00:00Z"), ZoneOffset.UTC));
    @AfterEach void clearTeam() { TeamContext.clear(); }

    @Test void usesKoreanCalendarYearAndForwardsOnlyTheValidatedTeamScope() {
        TeamContext.set(27);
        var filter = new PlayerStatsFilter(2026, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, LocalDate.of(2026, 1, 1));
        when(repository.counts(27, filter)).thenReturn(new PlayerStatsRepository.MatchCounts(3, 3, 0, 0));
        when(repository.availableYears(27, filter.today())).thenReturn(List.of(2026, 2024));
        when(repository.players(27, filter)).thenReturn(List.of());
        var response = service.list(null, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false);
        assertThat(response.year()).isEqualTo(2026);
        assertThat(response.matchCount()).isEqualTo(3);
        assertThat(response.completedMatchCount()).isEqualTo(3);
        assertThat(response.availableYears()).containsExactly(2026, 2024);
        verify(repository).players(27, filter);
        verifyNoMoreInteractionsAfterExpectedCalls(filter);
    }
    private void verifyNoMoreInteractionsAfterExpectedCalls(PlayerStatsFilter filter) {
        verify(repository).counts(27, filter);
        verify(repository).availableYears(27, filter.today());
        verifyNoMoreInteractions(repository);
    }

    @Test void explicitScopeAndGuestOptionsArePreserved() {
        TeamContext.set(1);
        when(repository.counts(eq(1L), any())).thenReturn(new PlayerStatsRepository.MatchCounts(4, 1, 1, 2));
        when(repository.availableYears(eq(1L), any())).thenReturn(List.of(2026, 2025));
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
}
