package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import static com.jochookon.match.MatchTestData.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class MatchPlanTest {
    MatchRequest planned(List<MatchRequest.PlannedEntry> plan) {
        var base = request(null, List.of(participant(1, Attendance.UNCONFIRMED), participant(2, Attendance.UNCONFIRMED)), List.of());
        return new MatchRequest(base.playedOn(), base.kickoff(), base.venue(), base.opponent(), base.notes(), null, base.participants(), base.quarters(), plan);
    }
    MatchRequest.PlannedEntry entry(int quarter, LineupSlot slot, int order, long id) { return new MatchRequest.PlannedEntry(quarter, slot, order, id); }
    @Test void planDoesNotAssumeActualAttendanceOrCreditAnyQuarters() {
        var match = MatchRecord.create(planned(List.of(entry(1, LineupSlot.ST, 0, 1), entry(1, LineupSlot.ST, 1, 2), entry(4, LineupSlot.GK, 0, 1))));
        assertThat(match.getPlannedLineup()).hasSize(3);
        assertThat(match.getAppearances()).isEmpty(); assertThat(match.creditedQuarters(1)).isZero();
        assertThat(match.getParticipants()).allMatch(p -> p.getAttendance() == Attendance.UNCONFIRMED);
    }
    @Test void rejectsDuplicatePlacesPlayersAndOrphanSubstitutes() {
        assertThatThrownBy(() -> MatchRecord.create(planned(List.of(entry(1, LineupSlot.ST, 0, 1), entry(1, LineupSlot.GK, 0, 1))))).hasMessageContaining("같은 쿼터");
        assertThatThrownBy(() -> MatchRecord.create(planned(List.of(entry(1, LineupSlot.ST, 0, 1), entry(1, LineupSlot.ST, 0, 2))))).hasMessageContaining("같은 자리");
        assertThatThrownBy(() -> MatchRecord.create(planned(List.of(entry(1, LineupSlot.ST, 1, 1))))).hasMessageContaining("선발");
    }
    @Test void nonAttendingVoteCannotSilentlyRemoveOrInvalidateAnExistingPlan() {
        var initial = planned(List.of(entry(1, LineupSlot.GK, 0, 1)));
        var match = MatchRecord.create(initial);
        var changed = new MatchRequest(initial.playedOn(), initial.kickoff(), "", "", "", 0L,
                List.of(new MatchRequest.Participant(1L, Vote.ABSENT, Attendance.UNCONFIRMED)), initial.quarters(), initial.plannedLineup());
        assertThatThrownBy(() -> match.replace(changed)).hasMessageContaining("참석 예정");
        assertThat(match.getPlannedLineup()).isEqualTo(initial.plannedLineup());
        assertThatThrownBy(() -> MatchRecord.create(planned(List.of(entry(1, LineupSlot.ST, 0, 99))))).hasMessageContaining("참석 예정");
    }
}
