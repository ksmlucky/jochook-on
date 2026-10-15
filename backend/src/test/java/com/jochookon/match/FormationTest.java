package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import com.jochookon.player.PreferredPosition;
import java.util.*;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.CsvSource;
import tools.jackson.databind.ObjectMapper;

class FormationTest {
    MatchRequest request(Formation a, Formation b, MatchKind kind, List<MatchRequest.Appearance> lineup,
                         List<MatchRequest.PlannedEntry> plan) {
        var base = MatchTestData.request(null,
                List.of(MatchTestData.participant(1, Attendance.PRESENT), MatchTestData.participant(2, Attendance.PRESENT)), lineup);
        var participants = base.participants().stream().map(p -> new MatchRequest.Participant(p.playerId(), p.vote(), p.attendance(),
                kind == MatchKind.INTERNAL ? plan.stream().filter(e -> e.playerId().equals(p.playerId())).map(MatchRequest.PlannedEntry::team).findFirst().orElse(null) : null, true)).toList();
        return new MatchRequest(base.playedOn(), base.kickoff(), "", "", "", null, participants, base.quarters(), plan,
                null, null, kind, null, a, b);
    }
    @Test void missingFieldsDefaultNewRecordsAndLegacyHistoryToOriginalFormation() {
        var record = MatchRecord.create(request(null, null, MatchKind.EXTERNAL, List.of(), List.of()));
        assertThat(record.getFormationA()).isEqualTo(Formation.F4123);
        assertThat(record.getFormationB()).isEqualTo(Formation.F4123);
        var snapshot = new ObjectMapper().readValue("""
                {"id":1,"participants":[],"quarters":[],"plannedLineup":[],"kind":"EXTERNAL"}
                """, MatchResponse.class);
        assertThat(snapshot.formationA()).isEqualTo(Formation.F4123);
        assertThat(snapshot.formationB()).isEqualTo(Formation.F4123);
    }
    @Test void omittedFormationOnUpdatePreservesSavedFormationAndValidatesAgainstIt() {
        var lineup = List.of(MatchTestData.appearance(LineupSlot.LST, 1, 1, 0));
        var record = MatchRecord.create(request(Formation.F442, null, MatchKind.EXTERNAL, lineup, List.of()));
        record.replace(request(null, null, MatchKind.EXTERNAL, lineup, List.of()));
        assertThat(record.getFormationA()).isEqualTo(Formation.F442);
        assertThat(record.getAppearances()).hasSize(1);
        assertThatThrownBy(() -> record.replace(request(null, null, MatchKind.EXTERNAL,
                List.of(MatchTestData.appearance(LineupSlot.LW, 1, 0, 0)), List.of())))
                .hasMessageContaining("포메이션에 없는 자리");
        assertThat(record.getAppearances().getFirst().getSlot()).isEqualTo(LineupSlot.LST);
        assertThat(record.getAppearances().getFirst().getGoals()).isEqualTo(1);
    }
    @Test void bothPlanAndActualRecordsMustFitTheirOwnTeamFormation() {
        var a = new MatchRequest.Appearance(LineupSlot.LST, 1L, 0, 0, 0, MatchTeam.A);
        var b = new MatchRequest.Appearance(LineupSlot.CAM, 2L, 0, 0, 0, MatchTeam.B);
        var record = MatchRecord.create(request(Formation.F442, Formation.F4231, MatchKind.INTERNAL, List.of(a, b), List.of()));
        assertThat(record.getFormationA()).isEqualTo(Formation.F442);
        assertThat(record.getFormationB()).isEqualTo(Formation.F4231);
        assertThatThrownBy(() -> MatchRecord.create(request(Formation.F442, Formation.F4141,
                MatchKind.INTERNAL, List.of(a, b), List.of()))).hasMessageContaining("포메이션에 없는 자리");
        assertThatThrownBy(() -> MatchRecord.create(request(Formation.F442, null, MatchKind.EXTERNAL,
                List.of(), List.of(new MatchRequest.PlannedEntry(1, LineupSlot.ST, 0, 1L)))))
                .hasMessageContaining("포메이션에 없는 자리");
        assertThatThrownBy(() -> MatchRecord.create(request(Formation.F442, Formation.F442,
                MatchKind.EXTERNAL, List.of(), List.of()))).hasMessageContaining("상대 팀 포메이션");
    }
    @ParameterizedTest @EnumSource(Formation.class)
    void suggestsExactlySelectedElevenSlotsWithKeeperAndOriginalFairness(Formation formation) {
        assertThat(formation.slots()).hasSize(11).doesNotHaveDuplicates().contains(LineupSlot.GK);
        var candidates = new ArrayList<LineupOptimizer.Candidate>();
        for (int i = 0; i < formation.slots().size(); i++) {
            var slot = formation.slots().get(i);
            var preferred = switch (slot) {
                case LCB, CCB, RCB -> PreferredPosition.CB;
                case LCM, RCM -> PreferredPosition.CM;
                case LCDM, RCDM -> PreferredPosition.CDM;
                case LST, RST -> PreferredPosition.ST;
                default -> PreferredPosition.valueOf(slot.name());
            };
            candidates.add(new LineupOptimizer.Candidate(i + 1, List.of(preferred), 0, 0));
        }
        var suggestion = new LineupOptimizer().suggest(candidates, 42, formation);
        assertThat(suggestion.formation()).isEqualTo(formation);
        for (int q = 1; q <= 4; q++) {
            int quarter = q;
            assertThat(suggestion.plannedLineup().stream().filter(e -> e.quarterNumber() == quarter).toList())
                    .extracting(MatchRequest.PlannedEntry::slot).containsExactlyInAnyOrderElementsOf(formation.slots());
        }
        assertThat(suggestion.plannedLineup()).allMatch(e -> (e.playerId() == 1) == (e.slot() == LineupSlot.GK));
        assertThat(suggestion.allocations()).allMatch(a -> a.quarters() == 4 && a.restQuarters().isEmpty() && a.nonPreferredAppearances() == 0);
    }
    @Test void compatibleRoleNeverOutweighsExactThirdChoiceAndIsMarkedNonPreferred() {
        var firstWing = new LineupOptimizer.Candidate(1, List.of(PreferredPosition.LW), 0, 0);
        var thirdMid = new LineupOptimizer.Candidate(2, List.of(PreferredPosition.ST, PreferredPosition.CB, PreferredPosition.LM), 0, 0);
        assertThat(firstWing.score(LineupSlot.LM)).isEqualTo(20).isLessThan(thirdMid.score(LineupSlot.LM));
        assertThat(firstWing.exactScore(LineupSlot.LM)).isZero();
        assertThat(thirdMid.score(LineupSlot.LM)).isEqualTo(30);
        assertThat(new LineupOptimizer.Candidate(3, List.of(PreferredPosition.LM), 0, 0).score(LineupSlot.LW)).isEqualTo(20);
        var suggested = new LineupOptimizer().suggest(List.of(firstWing), 0, Formation.F442);
        assertThat(suggested.allocations().getFirst().nonPreferredAppearances()).isEqualTo(4);
        assertThat(suggested.warnings()).anyMatch(w -> w.contains("20/12/6"));
    }
    @ParameterizedTest @CsvSource({"LB,LWB", "LWB,LB", "LM,LWB", "LWB,LM", "RB,RWB", "RWB,RB", "RM,RWB", "RWB,RM"})
    void wingBackCompatibilityIsSymmetricAndBelowEveryExactPreference(PreferredPosition first, LineupSlot target) {
        var candidate = new LineupOptimizer.Candidate(1, List.of(first), 0, 0);
        assertThat(candidate.score(target)).isEqualTo(20);
        assertThat(candidate.exactScore(target)).isZero();
        var exactThird = new LineupOptimizer.Candidate(2,
                List.of(PreferredPosition.ST, first, PreferredPosition.valueOf(target.name())), 0, 0);
        assertThat(exactThird.score(target)).isEqualTo(30);
    }
    @Test void wingBackFallbackUsesHighestCompatibleRankWithoutStackingOrCrossingSides() {
        assertThat(new LineupOptimizer.Candidate(1, List.of(PreferredPosition.LM, PreferredPosition.LB), 0, 0).score(LineupSlot.LWB)).isEqualTo(20);
        assertThat(new LineupOptimizer.Candidate(2, List.of(PreferredPosition.ST, PreferredPosition.LM, PreferredPosition.LB), 0, 0).score(LineupSlot.LWB)).isEqualTo(12);
        assertThat(new LineupOptimizer.Candidate(3, List.of(PreferredPosition.ST, PreferredPosition.CB, PreferredPosition.LB), 0, 0).score(LineupSlot.LWB)).isEqualTo(6);
        assertThat(new LineupOptimizer.Candidate(4, List.of(PreferredPosition.RB, PreferredPosition.RM), 0, 0).score(LineupSlot.LWB)).isZero();
        assertThat(new LineupOptimizer.Candidate(5, List.of(PreferredPosition.CB), 0, 0).score(LineupSlot.CCB)).isEqualTo(100);
        assertThat(new LineupOptimizer.Candidate(6, List.of(PreferredPosition.GK), 0, 0).score(LineupSlot.LWB)).isZero();
    }
    @ParameterizedTest @EnumSource(value = Formation.class, names = {"F352", "F343"})
    void threeBackExtraPlayersStillReceiveFairQuartersWithoutConsecutiveRest(Formation formation) {
        var candidates = IntStream.rangeClosed(1, 13).mapToObj(i -> new LineupOptimizer.Candidate(i,
                List.of(PreferredPosition.CB, PreferredPosition.LWB, PreferredPosition.RWB), i, 13)).toList();
        var suggestion = new LineupOptimizer().suggest(candidates, 51, formation);
        assertThat(suggestion.plannedLineup()).allMatch(e -> formation.slots().contains(e.slot()) && e.slot() != LineupSlot.GK);
        assertThat(suggestion.plannedLineup()).noneMatch(e -> e.quarterNumber() < 4 && e.entryOrder() == 1);
        assertThat(suggestion.allocations().stream().mapToDouble(LineupSuggestion.Allocation::quarters).sum()).isEqualTo(40);
        double previous = -1;
        for (var allocation : suggestion.allocations()) {
            assertThat(allocation.quarters()).isGreaterThanOrEqualTo(previous); previous = allocation.quarters();
            for (int q = 1; q < 4; q++) assertThat(allocation.restQuarters().contains(q) && allocation.restQuarters().contains(q + 1)).isFalse();
        }
        assertThat(suggestion.allocations().getLast().quarters() - suggestion.allocations().getFirst().quarters()).isLessThanOrEqualTo(1);
    }
    @Test void threeBackBothSidesValidateTheirOwnSlotsWithoutLosingSubstitutionStats() {
        var lineup = List.of(new MatchRequest.Appearance(LineupSlot.CCB, 1L, 2, 0, 0, MatchTeam.A),
                new MatchRequest.Appearance(LineupSlot.CCB, 2L, 1, 1, 1, MatchTeam.A));
        var plan = List.of(new MatchRequest.PlannedEntry(1, LineupSlot.CCB, 0, 1L, MatchTeam.A),
                new MatchRequest.PlannedEntry(1, LineupSlot.RM, 0, 2L, MatchTeam.B));
        var record = MatchRecord.create(request(Formation.F352, Formation.F343, MatchKind.INTERNAL, lineup, plan));
        assertThat(record.creditedQuarters(1)).isEqualTo(0.5);
        assertThat(record.creditedQuarters(2)).isEqualTo(0.5);
        assertThat(record.getAppearances()).extracting(MatchAppearance::getGoals).containsExactly(2, 1);
        assertThatThrownBy(() -> record.replace(request(Formation.F442, Formation.F343, MatchKind.INTERNAL, lineup, plan)))
                .hasMessageContaining("포메이션에 없는 자리");
        assertThat(record.getFormationA()).isEqualTo(Formation.F352);
        assertThat(record.getAppearances()).hasSize(2);
    }
}
