package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class InternalMatchTest {
    static MatchRequest.Appearance a(long id, MatchTeam team, int order, int goals, int assists) {
        return new MatchRequest.Appearance(LineupSlot.ST, id, goals, assists, order, team);
    }
    static MatchRequest request(MatchKind kind, List<MatchRequest.Appearance> lineup, List<MatchRequest.PlannedEntry> plan) {
        return new MatchRequest(LocalDate.of(2026, 10, 18), LocalTime.of(11, 0), "", "", "", null,
                List.of(1L, 2L, 3L).stream().map(id -> new MatchRequest.Participant(id, Vote.ATTENDING, Attendance.PRESENT,
                        kind == MatchKind.INTERNAL ? plan.stream().filter(p -> p.playerId().equals(id)).map(MatchRequest.PlannedEntry::team).findFirst().orElse(null) : null, true)).toList(),
                List.of(new MatchRequest.Quarter(1, lineup), new MatchRequest.Quarter(2, List.of()), new MatchRequest.Quarter(3, List.of()), new MatchRequest.Quarter(4, List.of())),
                plan, 3, 2, kind);
    }
    @Test void samePositionInTwoTeamsDoesNotHalveTheirMinutesAndOnlyRealSubstitutesShare() {
        var match = MatchRecord.create(request(MatchKind.INTERNAL, List.of(a(1, MatchTeam.A, 0, 3, 0), a(2, MatchTeam.B, 0, 1, 0), a(3, MatchTeam.B, 1, 1, 1)), List.of()));
        assertThat(match.getKind()).isEqualTo(MatchKind.INTERNAL);
        assertThat(match.creditedQuarters(1)).isEqualTo(1);
        assertThat(match.creditedQuarters(2)).isEqualTo(0.5);
        assertThat(match.creditedQuarters(3)).isEqualTo(0.5);
    }
    @Test void rejectsDuplicatePlayerAcrossTeamsInActualAndPlan() {
        assertThatIllegalArgumentException().isThrownBy(() -> MatchRecord.create(request(MatchKind.INTERNAL,
                List.of(a(1, MatchTeam.A, 0, 0, 0), a(1, MatchTeam.B, 0, 0, 0)), List.of()))).withMessageContaining("중복");
        assertThatIllegalArgumentException().isThrownBy(() -> MatchRecord.create(request(MatchKind.INTERNAL, List.of(),
                List.of(new MatchRequest.PlannedEntry(1, LineupSlot.ST, 0, 1L, MatchTeam.A), new MatchRequest.PlannedEntry(1, LineupSlot.ST, 0, 1L, MatchTeam.B))))).withMessageContaining("중복");
    }
    @Test void aStarterOrGoalsInTheOtherTeamCannotValidateASubstituteOrAssist() {
        assertThatIllegalArgumentException().isThrownBy(() -> MatchRecord.create(request(MatchKind.INTERNAL,
                List.of(a(1, MatchTeam.A, 0, 1, 0), a(2, MatchTeam.B, 1, 0, 0)), List.of()))).withMessageContaining("선발");
        assertThatIllegalArgumentException().isThrownBy(() -> MatchRecord.create(request(MatchKind.INTERNAL,
                List.of(a(1, MatchTeam.A, 0, 1, 0), a(2, MatchTeam.B, 0, 0, 1)), List.of()))).withMessageContaining("도움");
        assertThatIllegalArgumentException().isThrownBy(() -> MatchRecord.create(request(MatchKind.INTERNAL, List.of(),
                List.of(new MatchRequest.PlannedEntry(1, LineupSlot.ST, 0, 1L, MatchTeam.A), new MatchRequest.PlannedEntry(1, LineupSlot.ST, 1, 2L, MatchTeam.B))))).withMessageContaining("선발");
    }
    @Test void externalMatchesRejectTeamBInBothPlansAndActualRecords() {
        assertThatIllegalArgumentException().isThrownBy(() -> MatchRecord.create(request(MatchKind.EXTERNAL, List.of(a(1, MatchTeam.B, 0, 0, 0)), List.of()))).withMessageContaining("외부 경기");
        assertThatIllegalArgumentException().isThrownBy(() -> MatchRecord.create(request(MatchKind.EXTERNAL, List.of(), List.of(new MatchRequest.PlannedEntry(1, LineupSlot.GK, 0, 1L, MatchTeam.B))))).withMessageContaining("외부 경기");
    }
}
