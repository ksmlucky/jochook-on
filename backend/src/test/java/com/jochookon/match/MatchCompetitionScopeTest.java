package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.jochookon.player.PlayerRepository;
import com.jochookon.team.TeamContext;
import com.jochookon.tournament.TournamentService;
import java.util.List;
import org.junit.jupiter.api.*;
import org.springframework.data.domain.PageImpl;

class MatchCompetitionScopeTest {
    final MatchRepository repository = mock(MatchRepository.class);
    final TournamentService tournaments = mock(TournamentService.class);
    final MatchService service = new MatchService(repository, mock(PlayerRepository.class), mock(MatchHistoryService.class), tournaments);
    @BeforeEach void scope() { TeamContext.set(27); }
    @AfterEach void clear() { TeamContext.clear(); }
    @Test void scopeIsAppliedByDatabaseBeforePagination() {
        when(repository.findCompetitionMatches(eq(27L), isNull(), eq("LEAGUE"), any())).thenReturn(new PageImpl<>(List.of()));
        var result = service.list(3, 20, null, CompetitionScope.LEAGUE);
        assertThat(result.competitionScope()).isEqualTo(CompetitionScope.LEAGUE);
        verify(repository).findCompetitionMatches(eq(27L), isNull(), eq("LEAGUE"), argThat(p -> p.getPageNumber() == 3 && p.getPageSize() == 20));
        verifyNoInteractions(tournaments);
    }
    @Test void invalidLeagueIdIsRejectedBeforeAnyLookup() {
        assertThatThrownBy(() -> service.list(0, 10, 7L, CompetitionScope.LEAGUE)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(repository, tournaments);
    }
    @Test void monthBoundsAndScopeAreAppliedBeforePagingAndYearsAreTeamScoped() {
        var from = java.time.LocalDate.of(2024, 2, 1); var through = java.time.LocalDate.of(2024, 2, 29);
        when(repository.findPeriodMatches(eq(27L), isNull(), eq("LEAGUE"), eq(from), eq(through), any())).thenReturn(new PageImpl<>(List.of()));
        service.list(2, 10, null, CompetitionScope.LEAGUE, 2024, 2);
        verify(repository).findPeriodMatches(eq(27L), isNull(), eq("LEAGUE"), eq(from), eq(through), argThat(p -> p.getPageNumber() == 2));
        when(repository.years(27)).thenReturn(List.of(2025, 2024));
        assertThat(service.years()).containsExactly(2025, 2024);
        assertThatThrownBy(() -> service.list(0, 10, null, CompetitionScope.ALL, null, 2)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void specificTournamentIsValidatedInCurrentTeamAndSupportsBothScopes() {
        when(repository.findByTeamIdAndTournamentId(eq(27L), eq(7L), any())).thenReturn(new PageImpl<>(List.of()));
        when(repository.findCompetitionMatches(eq(27L), eq(7L), eq("TOURNAMENT"), any())).thenReturn(new PageImpl<>(List.of()));
        assertThat(service.list(0, 10, 7L).competitionScope()).isEqualTo(CompetitionScope.ALL);
        assertThat(service.list(0, 10, 7L, CompetitionScope.TOURNAMENT).competitionScope()).isEqualTo(CompetitionScope.TOURNAMENT);
        verify(tournaments, times(2)).require(7);
    }
}
