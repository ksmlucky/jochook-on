package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import com.jochookon.player.PreferredPosition;
import java.util.*;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class LineupOptimizerTest {
    static LineupOptimizer.Candidate field(int id) {
        var positions = List.of(PreferredPosition.LB, PreferredPosition.CB, PreferredPosition.RB, PreferredPosition.CDM, PreferredPosition.CM, PreferredPosition.LW, PreferredPosition.ST, PreferredPosition.RW);
        return new LineupOptimizer.Candidate(id, List.of(positions.get((id - 1) % 8)), id, 50);
    }
    @ParameterizedTest @ValueSource(ints = {1, 9, 10, 11, 12, 18, 20, 21, 30, 40})
    void fillsAvailableSlotsWithoutConsecutiveRestAndRespectsAttendanceAndOneQuarterGap(int count) {
        var candidates = IntStream.rangeClosed(1, count).mapToObj(LineupOptimizerTest::field).toList();
        var result = new LineupOptimizer().suggest(candidates, 123);
        assertThat(result.allocations().stream().mapToDouble(LineupSuggestion.Allocation::quarters).sum()).isEqualTo(Math.min(count, 10) * 4);
        assertThat(result.plannedLineup()).noneMatch(e -> e.slot() == LineupSlot.GK);
        for (int q = 1; q <= 4; q++) {
            int quarter = q;
            var entries = result.plannedLineup().stream().filter(e -> e.quarterNumber() == quarter).toList();
            assertThat(entries.stream().map(MatchRequest.PlannedEntry::playerId).distinct().count()).isEqualTo(entries.size());
            assertThat(entries.stream().filter(e -> e.entryOrder() == 0).count()).isEqualTo(Math.min(count, 10));
            for (var e : entries) if (e.entryOrder() == 1)
                assertThat(entries).anyMatch(starter -> starter.slot() == e.slot() && starter.entryOrder() == 0 && !starter.playerId().equals(e.playerId()));
        }
        var allocations = result.allocations();
        for (int i = 0; i < count; i++) {
            var a = allocations.get(i);
            for (int q = 1; q < 4; q++) assertThat(a.restQuarters().contains(q) && a.restQuarters().contains(q + 1)).isFalse();
            if (i > 0) assertThat(a.quarters()).isGreaterThanOrEqualTo(allocations.get(i - 1).quarters());
        }
        assertThat(allocations.get(count - 1).quarters() - allocations.getFirst().quarters()).isLessThanOrEqualTo(1);
        if (count <= 20) assertThat(result.plannedLineup()).noneMatch(e -> e.quarterNumber() < 4 && e.entryOrder() == 1);
        if (count == 11) assertThat(result.plannedLineup()).anyMatch(e -> e.quarterNumber() == 4 && e.entryOrder() == 1);
    }
    @ParameterizedTest @ValueSource(ints = {1, 2, 3, 4})
    void allPreferenceRanksCountAsGkAndNeverPlayField(int count) {
        var input = new ArrayList<>(IntStream.rangeClosed(1, 10).mapToObj(LineupOptimizerTest::field).toList());
        for (int i = 0; i < count; i++) input.add(new LineupOptimizer.Candidate(100 + i,
                List.of(PreferredPosition.CB, PreferredPosition.ST, PreferredPosition.GK), 0, 0));
        var result = new LineupOptimizer().suggest(input, 42);
        assertThat(result.plannedLineup()).allMatch(e -> (e.playerId() >= 100) == (e.slot() == LineupSlot.GK));
        assertThat(result.allocations().stream().filter(a -> a.group().equals("GK")).mapToDouble(LineupSuggestion.Allocation::quarters).sum()).isEqualTo(4);
        result.allocations().forEach(a -> { for (int q = 1; q < 4; q++) assertThat(a.restQuarters().contains(q) && a.restQuarters().contains(q + 1)).isFalse(); });
    }
    @Test void unknownPreferenceIsUnassignedAndImpossibleRosterHasClearError() {
        var unknown = new LineupOptimizer.Candidate(999, Arrays.asList(null, null, null), 0, 0);
        var result = new LineupOptimizer().suggest(List.of(unknown), 0);
        assertThat(result.plannedLineup()).isEmpty();
        assertThat(result.allocations().getFirst().group()).isEqualTo("UNKNOWN");
        assertThat(result.warnings()).anyMatch(w -> w.contains("미확인"));
        assertThatThrownBy(() -> new LineupOptimizer().suggest(IntStream.rangeClosed(1, 41).mapToObj(LineupOptimizerTest::field).toList(), 0))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("연속 휴식");
    }
    @Test void prefersFirstChoicesAndTreatsCbCmAsTwoEquivalentSlots() {
        var choices = List.of(PreferredPosition.LB, PreferredPosition.CB, PreferredPosition.CB, PreferredPosition.RB, PreferredPosition.CDM,
                PreferredPosition.CM, PreferredPosition.CM, PreferredPosition.LW, PreferredPosition.ST, PreferredPosition.RW);
        var input = IntStream.range(0, choices.size()).mapToObj(i -> new LineupOptimizer.Candidate(i + 1, List.of(choices.get(i)), 0, 0)).toList();
        var result = new LineupOptimizer().suggest(input, 2);
        assertThat(result.allocations()).allMatch(a -> a.nonPreferredAppearances() == 0);
        var reversed = new ArrayList<>(input); Collections.reverse(reversed);
        assertThat(new LineupOptimizer().suggest(reversed, 2)).isEqualTo(result);
    }
}
