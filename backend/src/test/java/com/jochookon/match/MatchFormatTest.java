package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import java.util.*;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import com.jochookon.player.PreferredPosition;
import tools.jackson.databind.json.JsonMapper;

class MatchFormatTest {
    private MatchRequest input(MatchFormat format, List<MatchRequest.Quarter> quarters, List<MatchRequest.PlannedEntry> plan) {
        return new MatchRequest(java.time.LocalDate.of(2026, 10, 15), java.time.LocalTime.of(11, 0), "", "", "", null,
                List.of(MatchTestData.participant(1, Attendance.PRESENT), MatchTestData.participant(2, Attendance.PRESENT)),
                quarters, plan, null, null, MatchKind.EXTERNAL, RecordingStage.ACTUAL,
                Formation.F4123, Formation.F4123, null, null, null, format);
    }
    private List<MatchRequest.Quarter> empty(int count) {
        return IntStream.rangeClosed(1, count).mapToObj(q -> new MatchRequest.Quarter(q, List.of())).toList();
    }
    @Test void halvesCountAsOneQuarterEachAndSubstitutesShareHalfWithoutMinutesConversion() {
        var halves = List.of(new MatchRequest.Quarter(1, List.of(new MatchRequest.Appearance(LineupSlot.ST, 1L, 2, 0, 0, MatchTeam.A, 1, 1))),
                new MatchRequest.Quarter(2, List.of(new MatchRequest.Appearance(LineupSlot.ST, 1L, 1, 0, 0), new MatchRequest.Appearance(LineupSlot.ST, 2L, 1, 1, 1))));
        var match = MatchRecord.create(input(MatchFormat.TWO_HALVES_30, halves, List.of()));
        assertThat(match.getMatchFormat()).isEqualTo(MatchFormat.TWO_HALVES_30);
        assertThat(match.getQuarters()).hasSize(2);
        assertThat(match.creditedQuarters(1)).isEqualTo(1.5);
        assertThat(match.creditedQuarters(2)).isEqualTo(0.5);
        match.replace(input(null, halves, List.of()));
        assertThat(match.getMatchFormat()).isEqualTo(MatchFormat.TWO_HALVES_30);
        assertThat(match.getAppearances()).extracting(MatchAppearance::getGoals).containsExactly(2, 1, 1);
    }
    @Test void omittedNewFormatRemainsFourAndHistoryOmissionDefaultsFour() {
        assertThat(MatchRecord.create(input(null, empty(4), List.of())).getMatchFormat()).isEqualTo(MatchFormat.FOUR_QUARTERS);
        assertThatThrownBy(() -> MatchRecord.create(input(null, empty(2), List.of()))).hasMessageContaining("1~4");
        var old = JsonMapper.builder().build().readValue("{\"id\":1,\"participants\":[],\"quarters\":[],\"plannedLineup\":[]}", MatchResponse.class);
        assertThat(old.matchFormat()).isEqualTo(MatchFormat.FOUR_QUARTERS);
    }
    @Test void rejectsExtraMissingDuplicateOrThirdPlannedPeriodForHalves() {
        for (var quarters : List.of(empty(4), List.of(new MatchRequest.Quarter(1, List.of()), new MatchRequest.Quarter(3, List.of())),
                List.of(new MatchRequest.Quarter(1, List.of()), new MatchRequest.Quarter(1, List.of()))))
            assertThatThrownBy(() -> MatchRecord.create(input(MatchFormat.TWO_HALVES_30, quarters, List.of()))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> MatchRecord.create(input(MatchFormat.TWO_HALVES_30, empty(2), List.of(new MatchRequest.PlannedEntry(3, LineupSlot.ST, 0, 1L)))))
                .hasMessageContaining("계획 스쿼드");
        var halves = input(MatchFormat.TWO_HALVES_30, empty(2), List.of());
        var internal = new MatchRequest(halves.playedOn(), halves.kickoff(), "", "", "", null, halves.participants(), halves.quarters(), List.of(),
                null, null, MatchKind.INTERNAL, null, null, null, null, null, null, MatchFormat.TWO_HALVES_30);
        assertThatThrownBy(() -> MatchRecord.create(internal)).hasMessageContaining("자체전");
    }
    @Test void formatChangeCannotSilentlyDropStoredThirdAndFourthActualOrPlan() {
        for (boolean actual : List.of(true, false)) {
            var four = new ArrayList<>(empty(4));
            if (actual) four.set(2, new MatchRequest.Quarter(3, List.of(new MatchRequest.Appearance(LineupSlot.ST, 1L, 2, 0, 0))));
            var plan = actual ? List.<MatchRequest.PlannedEntry>of() : List.of(new MatchRequest.PlannedEntry(4, LineupSlot.ST, 0, 1L));
            var match = MatchRecord.create(input(MatchFormat.FOUR_QUARTERS, four, plan));
            assertThatThrownBy(() -> match.replace(input(MatchFormat.TWO_HALVES_30, empty(2), List.of()))).hasMessageContaining("저장된 3·4쿼터");
            assertThat(match.getMatchFormat()).isEqualTo(MatchFormat.FOUR_QUARTERS);
            assertThat(match.getQuarters()).hasSize(4);
            assertThat(actual ? match.getAppearances().size() : match.getPlannedLineup().size()).isEqualTo(1);
            // Only a separately saved removal while still four quarters permits the later conversion.
            match.replace(input(MatchFormat.FOUR_QUARTERS, empty(4), List.of()));
            match.replace(input(MatchFormat.TWO_HALVES_30, empty(2), List.of()));
            assertThat(match.getMatchFormat()).isEqualTo(MatchFormat.TWO_HALVES_30);
        }
    }
    @Test void explicitFormatChangesReceiptWhileOmissionPreservesLegacyFingerprint() {
        var json = JsonMapper.builder().build();
        var omitted = input(null, empty(4), List.of());
        assertThat(MatchSaveFingerprint.of(omitted, json)).isNotEqualTo(MatchSaveFingerprint.of(input(MatchFormat.FOUR_QUARTERS, empty(4), List.of()), json));
        assertThat(MatchSaveFingerprint.of(input(MatchFormat.TWO_HALVES_30, empty(2), List.of()), json))
                .isNotEqualTo(MatchSaveFingerprint.of(input(MatchFormat.FOUR_QUARTERS, empty(2), List.of()), json));
    }
    @ParameterizedTest @ValueSource(ints = {10, 11, 13, 20, 40})
    void optimizerSolvesBothHalvesTogetherWithKeeperIsolationFairnessAndNoAbsentPlayers(int fields) {
        var people = new ArrayList<LineupOptimizer.Candidate>();
        people.add(new LineupOptimizer.Candidate(1000, List.of(PreferredPosition.GK), 0, 0));
        for (int p = 1; p <= fields; p++) people.add(new LineupOptimizer.Candidate(p, List.of(PreferredPosition.CM, PreferredPosition.CB, PreferredPosition.ST), p, fields));
        var result = new LineupOptimizer().suggest(people, 11, Formation.F352, MatchFormat.TWO_HALVES_30);
        assertThat(result.matchFormat()).isEqualTo(MatchFormat.TWO_HALVES_30);
        assertThat(result.plannedLineup()).allMatch(e -> e.quarterNumber() <= 2 && (e.slot() == LineupSlot.GK) == (e.playerId() == 1000));
        var fieldAllocations = result.allocations().stream().filter(a -> a.playerId() != 1000).toList();
        assertThat(fieldAllocations.stream().mapToDouble(LineupSuggestion.Allocation::quarters).sum()).isEqualTo(20);
        assertThat(result.allocations()).filteredOn(a -> a.playerId() == 1000).extracting(LineupSuggestion.Allocation::quarters).containsExactly(2.0);
        assertThat(fieldAllocations).allMatch(a -> a.quarters() > 0 && a.restQuarters().size() <= 1);
        double previous = 0;
        for (var a : fieldAllocations) { assertThat(a.quarters()).isGreaterThanOrEqualTo(previous); previous = a.quarters(); }
        assertThat(fieldAllocations.getLast().quarters() - fieldAllocations.getFirst().quarters()).isLessThanOrEqualTo(1);
        if (fields <= 20) assertThat(result.plannedLineup()).noneMatch(e -> e.quarterNumber() == 1 && e.entryOrder() == 1);
    }
}
