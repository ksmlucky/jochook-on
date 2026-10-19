package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import static com.jochookon.match.MatchTestData.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class MatchGoalEventsTest {
    private MatchRequest requestWith(List<MatchRequest.GoalEvent> events) {
        var base = request(null, List.of(participant(1, Attendance.PRESENT), participant(2, Attendance.PRESENT)),
                List.of(appearance(LineupSlot.ST, 1, 9, 0), appearance(LineupSlot.LW, 2, 0, 8)));
        return withQuarter(base, new MatchRequest.Quarter(1, base.quarters().getFirst().lineup(), events));
    }
    private MatchRequest withQuarter(MatchRequest base, MatchRequest.Quarter quarter) {
        var periods = new ArrayList<>(base.quarters()); periods.set(0, quarter);
        return new MatchRequest(base.playedOn(), base.kickoff(), base.venue(), base.opponent(), base.notes(), base.version(),
                base.participants(), periods, base.plannedLineup(), base.scoreFor(), base.scoreAgainst(), base.kind());
    }
    private MatchRequest.GoalEvent goal(Long scorer, Long assist, GoalType type) {
        return new MatchRequest.GoalEvent(scorer, assist, type, MatchTeam.A);
    }
    @Test void eventsAreAuthoritativeAndDeriveAllStatsWithoutAddingOldTotals() {
        var events = List.of(goal(1L, 2L, GoalType.NORMAL), goal(1L, null, GoalType.FREE_KICK), goal(2L, null, GoalType.PENALTY));
        var match = MatchRecord.create(requestWith(events));
        assertThat(match.getAppearances()).extracting(MatchAppearance::getGoals).containsExactly(2, 1);
        assertThat(match.getAppearances()).extracting(MatchAppearance::getAssists).containsExactly(0, 1);
        assertThat(match.getAppearances()).extracting(MatchAppearance::getFreeKickGoals).containsExactly(1, 0);
        assertThat(match.getAppearances()).extracting(MatchAppearance::getPenaltyGoals).containsExactly(0, 1);
        assertThat(match.getGoalEvents().stream().map(MatchGoalEvent::response)).containsExactlyElementsOf(events);
        assertThat(match.getQuarters().getFirst().isGoalEventsLinked()).isTrue();
    }
    @Test void emptyLinkedQuarterClearsAllTotalsButLegacyKeepsThem() {
        assertThat(MatchRecord.create(requestWith(List.of())).getAppearances()).allSatisfy(a -> {
            assertThat(a.getGoals()).isZero(); assertThat(a.getAssists()).isZero();
        });
        assertThat(MatchRecord.create(requestWith(null)).getAppearances()).extracting(MatchAppearance::getGoals).containsExactly(9, 0);
    }
    @Test void legacyEditPreservesLinkedEventsAndRejectsChangingTheirTotals() {
        var input = requestWith(List.of(goal(1L, 2L, GoalType.NORMAL)));
        var match = MatchRecord.create(input);
        var normalized = input.resolveGoalEvents(List.of(), List.of());
        var legacy = withQuarter(normalized, new MatchRequest.Quarter(1, normalized.quarters().getFirst().lineup()));
        match.replace(legacy);
        assertThat(match.getGoalEvents()).hasSize(1);
        assertThat(match.getQuarters().getFirst().isGoalEventsLinked()).isTrue();
        assertThatThrownBy(() -> match.replace(requestWith(null))).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("최신 화면");
        assertThat(match.getGoalEvents()).hasSize(1);
    }
    @Test void retainedEventCannotLoseScorerOrMoveHelperAcrossTeams() {
        var input = requestWith(List.of(goal(1L, 2L, GoalType.NORMAL)));
        var match = MatchRecord.create(input);
        var removed = withQuarter(input, new MatchRequest.Quarter(1, List.of(appearance(LineupSlot.ST, 1, 1, 0))));
        assertThatThrownBy(() -> match.replace(removed)).hasMessageContaining("도움 선수");
        var crossTeam = new MatchRequest.Quarter(1, List.of(appearance(LineupSlot.ST, 1, 1, 0),
                new MatchRequest.Appearance(LineupSlot.LW, 2L, 0, 1, 0, MatchTeam.B)), input.quarters().getFirst().goalEvents());
        assertThatThrownBy(() -> MatchGoalEvents.resolve(List.of(crossTeam), MatchKind.INTERNAL, List.of(), List.of())).hasMessageContaining("도움 선수");
    }
    @Test void selfAssistMissingScorerAndSetPieceAssistAreRejected() {
        for (var event : List.of(goal(1L, 1L, GoalType.NORMAL), goal(3L, null, GoalType.NORMAL),
                goal(1L, 2L, GoalType.FREE_KICK), goal(1L, 2L, GoalType.PENALTY)))
            assertThatThrownBy(() -> MatchRecord.create(requestWith(List.of(event)))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> MatchRecord.create(requestWith(List.of(new MatchRequest.GoalEvent(1L, null, GoalType.NORMAL, MatchTeam.B)))))
                .hasMessageContaining("우리 팀");
    }
    @Test void countLimitAndPerQuarterPresenceAreEnforced() {
        assertThatThrownBy(() -> MatchRecord.create(requestWith(Collections.nCopies(100, goal(1L, null, GoalType.NORMAL)))))
                .hasMessageContaining("99개");
        var input = requestWith(List.of(goal(1L, 2L, GoalType.NORMAL)));
        var periods = new ArrayList<>(input.quarters());
        periods.set(1, new MatchRequest.Quarter(2, List.of(), List.of(goal(1L, null, GoalType.NORMAL))));
        assertThatThrownBy(() -> MatchGoalEvents.resolve(periods, MatchKind.EXTERNAL, List.of(), List.of())).hasMessageContaining("출전 명단");
    }
    @Test void fingerprintIncludesLinkedModeAndIndividualPairingAndOrder() {
        var mapper = JsonMapper.builder().build();
        var legacy = requestWith(null);
        var empty = requestWith(List.of());
        var assisted = requestWith(List.of(goal(1L, 2L, GoalType.NORMAL)));
        var unassisted = requestWith(List.of(goal(1L, null, GoalType.NORMAL)));
        var hashes = List.of(legacy, empty, assisted, unassisted).stream().map(r -> MatchSaveFingerprint.of(r, mapper)).toList();
        assertThat(new HashSet<>(hashes)).hasSize(4);
        var one = goal(1L, null, GoalType.NORMAL); var two = goal(2L, null, GoalType.NORMAL);
        assertThat(MatchSaveFingerprint.of(requestWith(List.of(one, two)), mapper))
                .isNotEqualTo(MatchSaveFingerprint.of(requestWith(List.of(two, one)), mapper));
    }
    @Test void substitutionGetsHalfQuarterButFullGoalAndAssistCounts() {
        var input = requestWith(List.of(goal(1L, 2L, GoalType.NORMAL)));
        var lineup = List.of(appearance(LineupSlot.ST, 1, 0, 0), new MatchRequest.Appearance(LineupSlot.ST, 2L, 0, 0, 1));
        var match = MatchRecord.create(withQuarter(input, new MatchRequest.Quarter(1, lineup, input.quarters().getFirst().goalEvents())));
        assertThat(match.creditedQuarters(1)).isEqualTo(0.5);
        assertThat(match.creditedQuarters(2)).isEqualTo(0.5);
        assertThat(match.getAppearances().get(0).getGoals()).isEqualTo(1);
        assertThat(match.getAppearances().get(1).getAssists()).isEqualTo(1);
    }
}
