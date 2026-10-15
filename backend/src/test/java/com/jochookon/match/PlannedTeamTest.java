package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class PlannedTeamTest {
    private MatchRequest input(MatchKind kind, List<MatchRequest.Participant> people, List<MatchRequest.PlannedEntry> plan,
                               List<MatchRequest.Appearance> actual) {
        var base = MatchTestData.request(null, people, actual);
        return new MatchRequest(base.playedOn(), base.kickoff(), "", "", "", null, people, base.quarters(), plan,
                null, null, kind);
    }
    private MatchRequest.Participant assigned(long id, MatchTeam team) {
        return new MatchRequest.Participant(id, Vote.ATTENDING, Attendance.PRESENT, team, true);
    }
    @Test void formationRolesMatchTheNewThreeBackShapes() {
        assertThat(Formation.F352.slots()).contains(LineupSlot.CAM, LineupSlot.LWB, LineupSlot.RWB).doesNotContain(LineupSlot.CDM);
        assertThat(Formation.F343.slots()).contains(LineupSlot.LM, LineupSlot.RM).doesNotContain(LineupSlot.LWB, LineupSlot.RWB);
        assertThatThrownBy(() -> Formation.F352.requireSlot(LineupSlot.CDM)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Formation.F343.requireSlot(LineupSlot.LWB)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void planCannotUseUnassignedPlayersOrCrossTheirPreselectedTeamIncludingSubstitutes() {
        var plan = List.of(new MatchRequest.PlannedEntry(1, LineupSlot.ST, 0, 1L, MatchTeam.A));
        for (var team : new MatchTeam[] { null, MatchTeam.B })
            assertThatThrownBy(() -> MatchRecord.create(input(MatchKind.INTERNAL, List.of(assigned(1, team)), plan, List.of())))
                    .hasMessageContaining("01단계");
        var subs = List.of(plan.getFirst(), new MatchRequest.PlannedEntry(1, LineupSlot.ST, 1, 2L, MatchTeam.A));
        assertThatThrownBy(() -> MatchRecord.create(input(MatchKind.INTERNAL,
                List.of(assigned(1, MatchTeam.A), assigned(2, MatchTeam.B)), subs, List.of()))).hasMessageContaining("01단계");
    }
    @Test void omittedOldClientAssignmentIsPreservedWhileExplicitNullClearsAndActualCanDiffer() {
        var source = input(MatchKind.INTERNAL, List.of(assigned(1, MatchTeam.A)), List.of(),
                List.of(new MatchRequest.Appearance(LineupSlot.ST, 1L, 2, 0, 0, MatchTeam.B, 1, 1)));
        var match = MatchRecord.create(source);
        assertThat(match.getParticipants().getFirst().getPlannedTeam()).isEqualTo(MatchTeam.A);
        match.replace(input(MatchKind.INTERNAL, List.of(new MatchRequest.Participant(1L, Vote.ATTENDING, Attendance.PRESENT)),
                List.of(), source.quarters().getFirst().lineup()));
        assertThat(match.getParticipants().getFirst().getPlannedTeam()).isEqualTo(MatchTeam.A);
        match.replace(input(MatchKind.INTERNAL, List.of(assigned(1, null)), List.of(), source.quarters().getFirst().lineup()));
        assertThat(match.getParticipants().getFirst().getPlannedTeam()).isNull();
        assertThat(match.getAppearances().getFirst().getTeam()).isEqualTo(MatchTeam.B);
        assertThat(match.getAppearances().getFirst().getGoals()).isEqualTo(2);
        assertThat(match.creditedQuarters(1)).isEqualTo(1);
    }
    @Test void clearingAssignedPlayerWithPlanFailsWithoutReplacingAnyRecord() {
        var plan = List.of(new MatchRequest.PlannedEntry(1, LineupSlot.ST, 0, 1L, MatchTeam.A));
        var match = MatchRecord.create(input(MatchKind.INTERNAL, List.of(assigned(1, MatchTeam.A)), plan, List.of()));
        assertThatThrownBy(() -> match.replace(input(MatchKind.INTERNAL, List.of(assigned(1, null)), plan, List.of())))
                .hasMessageContaining("01단계");
        assertThat(match.getParticipants().getFirst().getPlannedTeam()).isEqualTo(MatchTeam.A);
        assertThat(match.getPlannedLineup()).isEqualTo(plan);
    }
    @Test void externalMatchesRejectPreassignedTeamButIncompleteInternalAttendanceCanSaveUnassigned() {
        assertThatThrownBy(() -> MatchRecord.create(input(MatchKind.EXTERNAL, List.of(assigned(1, MatchTeam.A)), List.of(), List.of())))
                .hasMessageContaining("자체전에서만");
        assertThat(MatchRecord.create(input(MatchKind.INTERNAL, List.of(assigned(1, null)), List.of(), List.of()))
                .getParticipants().getFirst().getPlannedTeam()).isNull();
    }
    @Test void explicitTeamAndClearHaveDifferentFingerprintsFromOmission() {
        var json = JsonMapper.builder().build();
        var omitted = input(MatchKind.INTERNAL, List.of(new MatchRequest.Participant(1L, Vote.ATTENDING, Attendance.PRESENT)), List.of(), List.of());
        var clear = input(MatchKind.INTERNAL, List.of(assigned(1, null)), List.of(), List.of());
        var a = input(MatchKind.INTERNAL, List.of(assigned(1, MatchTeam.A)), List.of(), List.of());
        var b = input(MatchKind.INTERNAL, List.of(assigned(1, MatchTeam.B)), List.of(), List.of());
        assertThat(List.of(omitted, clear, a, b).stream().map(r -> MatchSaveFingerprint.of(r, json))).doesNotHaveDuplicates();
        var implicitA = input(MatchKind.INTERNAL, List.of(new MatchRequest.Participant(1L, Vote.ATTENDING, Attendance.PRESENT, MatchTeam.A, null)), List.of(), List.of());
        assertThat(MatchSaveFingerprint.of(implicitA, json)).isEqualTo(MatchSaveFingerprint.of(a, json));
    }
}
