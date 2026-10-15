package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class GoalTypesTest {
    MatchRequest input(int goals, Integer fk, Integer pk) {
        return MatchTestData.request(null, List.of(MatchTestData.participant(1, Attendance.PRESENT)),
                List.of(new MatchRequest.Appearance(LineupSlot.ST, 1L, goals, 0, 0, MatchTeam.A, fk, pk)));
    }
    @Test void legacyNewRowsDefaultToZeroAndTypesRemainSubsets() {
        var old = MatchRecord.create(input(3, null, null));
        assertThat(old.getAppearances().getFirst().getFreeKickGoals()).isZero();
        assertThat(old.getAppearances().getFirst().getPenaltyGoals()).isZero();
        var typed = MatchRecord.create(input(3, 1, 1));
        assertThat(typed.getAppearances().getFirst().getGoals()).isEqualTo(3);
        assertThat(typed.getAppearances().getFirst().getFreeKickGoals()).isEqualTo(1);
        assertThat(typed.getAppearances().getFirst().getPenaltyGoals()).isEqualTo(1);
    }
    @Test void omittedTypesPreserveSamePlayerQuarterEvenIfPositionChanges() {
        var record = MatchRecord.create(input(3, 1, 2));
        var old = input(4, null, null);
        var moved = new MatchRequest(old.playedOn(), old.kickoff(), old.venue(), old.opponent(), old.notes(), null,
                old.participants(), List.of(new MatchRequest.Quarter(1, List.of(new MatchRequest.Appearance(LineupSlot.LW, 1L, 4, 0, 0))),
                old.quarters().get(1), old.quarters().get(2), old.quarters().get(3)));
        record.replace(moved);
        assertThat(record.getAppearances().getFirst().getFreeKickGoals()).isEqualTo(1);
        assertThat(record.getAppearances().getFirst().getPenaltyGoals()).isEqualTo(2);
        var nextQuarter = new MatchRequest(old.playedOn(), old.kickoff(), old.venue(), old.opponent(), old.notes(), null,
                old.participants(), List.of(new MatchRequest.Quarter(1, List.of()), new MatchRequest.Quarter(2, moved.quarters().getFirst().lineup()),
                old.quarters().get(2), old.quarters().get(3)));
        record.replace(nextQuarter);
        assertThat(record.getAppearances().getFirst().getFreeKickGoals()).isZero();
        assertThat(record.getAppearances().getFirst().getPenaltyGoals()).isZero();
    }
    @Test void explicitZeroClearsAndEachOmittedFieldPreservesIndependently() {
        var record = MatchRecord.create(input(3, 1, 2));
        record.replace(input(3, 0, null));
        assertThat(record.getAppearances().getFirst().getFreeKickGoals()).isZero();
        assertThat(record.getAppearances().getFirst().getPenaltyGoals()).isEqualTo(2);
        record.replace(input(0, 0, 0));
        assertThat(record.getAppearances().getFirst().getPenaltyGoals()).isZero();
    }
    @Test void reducingTotalBelowPreservedTypesFailsBeforeMutatingTheRecord() {
        var record = MatchRecord.create(input(3, 1, 2));
        assertThatThrownBy(() -> record.replace(input(2, null, null))).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("총득점");
        assertThat(record.getAppearances().getFirst().getGoals()).isEqualTo(3);
        for (var invalid : List.of(input(3, 2, 2), input(3, -1, 0), input(99, 100, 0)))
            assertThatThrownBy(() -> MatchRecord.create(invalid)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void oldAuditSnapshotsReadAsZerosWhileRequestsKeepOmission() {
        var json = JsonMapper.builder().build();
        var old = input(2, null, null);
        var response = new MatchResponse(1L, 0L, old.playedOn(), old.kickoff(), old.venue(), old.opponent(), old.notes(),
                List.of(), old.quarters(), List.of(), null, null, MatchKind.EXTERNAL, RecordingStage.COMPLETED);
        var tree = (tools.jackson.databind.node.ObjectNode) json.valueToTree(response);
        var a = (tools.jackson.databind.node.ObjectNode) tree.get("quarters").get(0).get("lineup").get(0);
        a.remove("freeKickGoals"); a.remove("penaltyGoals");
        var restored = json.treeToValue(tree, MatchResponse.class).quarters().getFirst().lineup().getFirst();
        assertThat(restored.freeKickGoals()).isZero(); assertThat(restored.penaltyGoals()).isZero();
        assertThat(json.readValue(json.writeValueAsString(old), MatchRequest.class).quarters().getFirst().lineup().getFirst().freeKickGoals()).isNull();
    }
}
