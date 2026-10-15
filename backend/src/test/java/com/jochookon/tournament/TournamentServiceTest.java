package com.jochookon.tournament;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.jochookon.team.TeamContext;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.*;
import org.springframework.data.domain.PageImpl;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.util.ReflectionTestUtils;

class TournamentServiceTest {
    final TournamentRepository repository = mock(TournamentRepository.class);
    final TournamentService service = new TournamentService(repository);
    @BeforeEach void scope() { TeamContext.set(27); }
    @AfterEach void clear() { TeamContext.clear(); }
    TournamentRequest input(Long version) {
        return new TournamentRequest(" 가상 대회 ", LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2), null, "30대부", null, version);
    }
    Tournament saved() {
        var t = Tournament.create(27, input(null));
        ReflectionTestUtils.setField(t, "id", 8L); ReflectionTestUtils.setField(t, "version", 2L); return t;
    }
    @Test void listScopesAndPaginatesThenCountsOnlyCurrentPage() {
        var t = saved();
        when(repository.findByTeamId(eq(27L), any())).thenReturn(new PageImpl<>(List.of(t)));
        var count = mock(TournamentRepository.MatchCount.class);
        when(count.getTournamentId()).thenReturn(8L); when(count.getCount()).thenReturn(3L);
        when(repository.matchCounts(27, List.of(8L))).thenReturn(List.of(count));
        assertThat(service.list(0, 10).items()).singleElement().satisfies(row -> {
            assertThat(row.name()).isEqualTo("가상 대회"); assertThat(row.matchCount()).isEqualTo(3);
            assertThat(row.venue()).isEmpty(); assertThat(row.notes()).isEmpty();
        });
        verify(repository).findByTeamId(eq(27L), argThat(p -> p.getPageSize() == 10 && p.getSort().getOrderFor("startDate").isDescending()));
    }
    @Test void updateRequiresMatchingVersionAndDoesNotModifyMatches() {
        var t = saved(); when(repository.findByIdAndTeamId(8, 27)).thenReturn(Optional.of(t));
        assertThatThrownBy(() -> service.update(8, input(null))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.update(8, input(1L))).isInstanceOf(ObjectOptimisticLockingFailureException.class);
        when(repository.saveAndFlush(t)).thenReturn(t);
        when(repository.matchCounts(27, List.of(8L))).thenReturn(List.of());
        assertThat(service.update(8, input(2L)).division()).isEqualTo("30대부");
        verify(repository, times(1)).saveAndFlush(t);
    }
    @Test void monthOverlapIsAppliedBeforePagingAndYearRangesIncludeTheMiddleYears() {
        var from = LocalDate.of(2024, 2, 1); var through = LocalDate.of(2024, 2, 29);
        when(repository.findOverlappingPeriod(eq(27L), eq(from), eq(through), any())).thenReturn(new PageImpl<>(List.of()));
        assertThat(service.list(2, 10, 2024, 2).items()).isEmpty();
        verify(repository).findOverlappingPeriod(eq(27L), eq(from), eq(through), argThat(p -> p.getPageNumber() == 2));
        var range = mock(TournamentRepository.YearRange.class);
        when(range.getFirstYear()).thenReturn(2023); when(range.getLastYear()).thenReturn(2025);
        when(repository.yearRanges(27)).thenReturn(List.of(range, range));
        assertThat(service.years()).containsExactly(2025, 2024, 2023);
        assertThatThrownBy(() -> service.list(0, 10, null, 2)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void crossTeamAndMissingHaveOneNotFound() {
        when(repository.findByIdAndTeamId(8, 27)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.get(8)).isInstanceOf(TournamentNotFoundException.class);
        verify(repository).findByIdAndTeamId(8, 27);
    }
    @Test void validatesDateBoundsAndOrderIncludingSameDay() {
        var date = LocalDate.of(2026, 10, 1);
        new TournamentRequest("대회", date, date, null, null, null, null).validate();
        assertThatThrownBy(() -> new TournamentRequest("대회", date, date.minusDays(1), "", "", "", null).validate()).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new TournamentRequest("대회", LocalDate.of(999, 1, 1), date, "", "", "", null).validate()).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new TournamentRequest("대회", date, LocalDate.of(10000, 1, 1), "", "", "", null).validate()).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.create(input(0L))).isInstanceOf(IllegalArgumentException.class);
    }
}
