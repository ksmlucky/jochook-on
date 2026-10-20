package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import static com.jochookon.match.MatchTestData.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class MatchScoringOrderTest {
    private final List<MatchRequest.GoalEvent> events = List.of(
            new MatchRequest.GoalEvent(1L, 2L, GoalType.NORMAL, MatchTeam.A),
            new MatchRequest.GoalEvent(2L, null, GoalType.PENALTY, MatchTeam.A));
    private MatchRequest requestWith(List<MatchRequest.GoalEvent> goals, Integer conceded, List<Integer> order, Boolean specified) {
        var base = request(null, List.of(participant(1, Attendance.PRESENT), participant(2, Attendance.PRESENT)),
                List.of(appearance(LineupSlot.ST, 1, 1, 0), new MatchRequest.Appearance(LineupSlot.LW, 2L, 1, 1, 0, MatchTeam.A, 0, 1)));
        var periods = new ArrayList<>(base.quarters());
        periods.set(0, new MatchRequest.Quarter(1, base.quarters().getFirst().lineup(), goals, conceded, true, order, specified));
        return new MatchRequest(base.playedOn(), base.kickoff(), base.venue(), base.opponent(), base.notes(), base.version(), base.participants(), periods);
    }
    @Test void completeInterleavedOrderDoesNotChangePlayerTotals() {
        var match = MatchRecord.create(requestWith(events, 2, List.of(-1, 0, -1, 1), true));
        assertThat(match.getQuarters().getFirst().getScoringOrder()).containsExactly(-1, 0, -1, 1);
        assertThat(match.getAppearances()).extracting(MatchAppearance::getGoals).containsExactly(1, 1);
        assertThat(match.getAppearances()).extracting(MatchAppearance::getAssists).containsExactly(0, 1);
        assertThat(match.getAppearances()).extracting(MatchAppearance::getPenaltyGoals).containsExactly(0, 1);
    }
    @Test void rejectMissingDuplicateOutOfRangeNullAndWrongConcededIndexes() {
        for (var order : List.of(List.of(0), List.of(0, 0, 1, -1), List.of(0, 2, -1), List.of(0, 1),
                List.of(0, 1, -2), Arrays.asList(0, 1, null), List.of(0, 1, -1, -1)))
            assertThatThrownBy(() -> MatchRecord.create(requestWith(events, 1, order, true))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> MatchRecord.create(requestWith(events, null, List.of(0, 1), true))).hasMessageContaining("실점");
        assertThatThrownBy(() -> MatchRecord.create(requestWith(null, 0, List.of(), true))).hasMessageContaining("골별");
    }
    @Test void oldClientPreservesOnlyAnUnchangedSourceAndExplicitClearWorks() {
        var saved = MatchRecord.create(requestWith(events, 1, List.of(0, -1, 1), true));
        saved.replace(requestWith(null, 1, null, null)); // old client's aggregate totals, no linked fields
        assertThat(saved.getQuarters().getFirst().getScoringOrder()).containsExactly(0, -1, 1);
        saved.replace(requestWith(events, 1, null, false));
        assertThat(saved.getQuarters().getFirst().getScoringOrder()).containsExactly(0, -1, 1);
        saved.replace(requestWith(events, 1, null, true));
        assertThat(saved.getQuarters().getFirst().getScoringOrder()).isNull();
        assertThat(saved.getGoalEvents()).hasSize(2);
    }
    @Test void changedScorerAssistTypeGoalOrderOrConcededClearsOmittedTimeline() {
        var changedGoals = List.of(List.of(events.get(1), events.get(0)), List.of(events.getFirst()),
                List.of(new MatchRequest.GoalEvent(1L, null, GoalType.NORMAL, MatchTeam.A), events.get(1)),
                List.of(events.getFirst(), new MatchRequest.GoalEvent(1L, null, GoalType.PENALTY, MatchTeam.A)),
                List.of(events.getFirst(), new MatchRequest.GoalEvent(2L, null, GoalType.FREE_KICK, MatchTeam.A)));
        for (var changed : changedGoals) {
            var saved = MatchRecord.create(requestWith(events, 1, List.of(0, -1, 1), true));
            saved.replace(requestWith(changed, 1, null, null));
            assertThat(saved.getQuarters().getFirst().getScoringOrder()).isNull();
        }
        var saved = MatchRecord.create(requestWith(events, 1, List.of(0, -1, 1), true));
        saved.replace(requestWith(events, 2, null, null));
        assertThat(saved.getQuarters().getFirst().getScoringOrder()).isNull();
    }
    @Test void internalOrderIncludesBothTeamsAndNeverExternalConcededMarkers() {
        var internalEvents = List.of(events.getFirst(), new MatchRequest.GoalEvent(3L, null, GoalType.NORMAL, MatchTeam.B));
        var q = new MatchRequest.Quarter(1, List.of(), internalEvents, null, null, List.of(1, 0), true);
        assertThatCode(() -> MatchScoringOrder.validate(q, MatchKind.INTERNAL)).doesNotThrowAnyException();
        assertThatThrownBy(() -> MatchScoringOrder.validate(new MatchRequest.Quarter(1, List.of(), internalEvents,
                null, null, List.of(1, -1, 0), true), MatchKind.INTERNAL)).hasMessageContaining("A·B팀");
    }
    @Test void zeroGoalsAndUnknownOrderRemainDifferentAfterPersistenceAndSerialization() {
        var converter = new ScoringOrderConverter();
        assertThat(converter.convertToEntityAttribute(converter.convertToDatabaseColumn(null))).isNull();
        assertThat(converter.convertToEntityAttribute(converter.convertToDatabaseColumn(List.of()))).isEmpty();
        assertThat(converter.convertToEntityAttribute(converter.convertToDatabaseColumn(List.of(0, -1, 1)))).containsExactly(0, -1, 1);
        var empty = MatchRecord.create(requestWith(List.of(), 0, List.of(), true));
        assertThat(empty.getQuarters().getFirst().getScoringOrder()).isEmpty();
        var unknown = MatchRecord.create(requestWith(List.of(), 0, null, null));
        assertThat(unknown.getQuarters().getFirst().getScoringOrder()).isNull();
    }
    @Test void fingerprintIncludesChronologyAndExplicitClearButNormalizesSpecifiedFlag() {
        var json = JsonMapper.builder().build();
        var known = requestWith(events, 1, List.of(0, -1, 1), true);
        assertThat(MatchSaveFingerprint.of(known, json)).isEqualTo(MatchSaveFingerprint.of(requestWith(events, 1, List.of(0, -1, 1), null), json));
        assertThat(List.of(known, requestWith(events, 1, List.of(-1, 0, 1), true), requestWith(events, 1, null, null), requestWith(events, 1, null, true))
                .stream().map(r -> MatchSaveFingerprint.of(r, json))).doesNotHaveDuplicates();
    }
}
