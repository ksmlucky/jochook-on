package com.hanafc.match;

import static com.hanafc.match.MatchTestData.*;
import static org.assertj.core.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class MatchRecordTest {
    @Test void savesVotesWithoutAssumingActualAttendanceOrLineups() {
        var match = MatchRecord.create(request(null, List.of(participant(1, Attendance.UNCONFIRMED)), List.of()));
        assertThat(match.getParticipants().getFirst().getVote()).isEqualTo(Vote.ATTENDING);
        assertThat(match.getParticipants().getFirst().getAttendance()).isEqualTo(Attendance.UNCONFIRMED);
        assertThat(match.getQuarters()).hasSize(4);
        assertThat(match.getAppearances()).isEmpty();
    }
    @ParameterizedTest @EnumSource(value = Attendance.class, names = {"ABSENT", "UNCONFIRMED"})
    void rejectsAppearancesForAbsentOrUnconfirmedPlayers(Attendance attendance) {
        assertThatThrownBy(() -> MatchRecord.create(request(null, List.of(participant(1, attendance)), List.of(appearance(LineupSlot.ST, 1, 1, 0)))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("실제 출석");
    }
    @Test void rejectsSamePlayerTwiceInOneQuarterButAllowsOtherQuarters() {
        var people = List.of(participant(1, Attendance.PRESENT));
        assertThatThrownBy(() -> MatchRecord.create(request(null, people, List.of(appearance(LineupSlot.ST, 1, 0, 0), appearance(LineupSlot.LW, 1, 0, 0)))))
                .hasMessageContaining("같은 선수를 중복");
        var source = request(null, people, List.of(appearance(LineupSlot.ST, 1, 1, 0)));
        var quarters = new ArrayList<>(source.quarters());
        quarters.set(1, new MatchRequest.Quarter(2, List.of(appearance(LineupSlot.RW, 1, 2, 0))));
        var match = MatchRecord.create(new MatchRequest(source.playedOn(), source.kickoff(), source.venue(), source.opponent(), source.notes(), null, people, quarters));
        assertThat(match.getAppearances()).hasSize(2);
        assertThat(match.getAppearances().stream().mapToInt(MatchAppearance::getGoals).sum()).isEqualTo(3);
    }
    @Test void rejectsDuplicatePositionsAndParticipants() {
        var people = List.of(participant(1, Attendance.PRESENT), participant(2, Attendance.LATE));
        assertThatThrownBy(() -> MatchRecord.create(request(null, people, List.of(appearance(LineupSlot.ST, 1, 0, 0), appearance(LineupSlot.ST, 2, 0, 0)))))
                .hasMessageContaining("같은 자리");
        assertThatThrownBy(() -> MatchRecord.create(request(null, List.of(people.getFirst(), people.getFirst()), List.of())))
                .hasMessageContaining("참가 명단");
    }
    @Test void rejectsUnknownParticipantsAndExcessAssists() {
        assertThatThrownBy(() -> MatchRecord.create(request(null, List.of(), List.of(appearance(LineupSlot.GK, 99, 0, 0)))))
                .hasMessageContaining("실제 출석");
        assertThatThrownBy(() -> MatchRecord.create(request(null, List.of(participant(1, Attendance.PRESENT)), List.of(appearance(LineupSlot.GK, 1, 0, 1)))))
                .hasMessageContaining("도움 합계");
    }
    @Test void rejectsDuplicateQuarterNumbersBeforeReplacingExistingData() {
        var source = request(null, List.of(participant(1, Attendance.PRESENT)), List.of(appearance(LineupSlot.ST, 1, 2, 0)));
        var match = MatchRecord.create(source);
        var bad = new MatchRequest(source.playedOn(), source.kickoff(), "", "", "", 0L, source.participants(), Collections.nCopies(4, source.quarters().getFirst()));
        assertThatThrownBy(() -> match.replace(bad)).hasMessageContaining("쿼터 번호");
        assertThat(match.getAppearances().getFirst().getGoals()).isEqualTo(2);
    }
    @Test void substitutionPairGetsHalfEachAndUnsubstitutedPlayerGetsOne() {
        var people = List.of(participant(1, Attendance.PRESENT), participant(2, Attendance.LATE), participant(3, Attendance.PRESENT));
        var match = MatchRecord.create(request(null, people, List.of(appearance(LineupSlot.ST, 1, 2, 0),
                new MatchRequest.Appearance(LineupSlot.ST, 2L, 1, 1, 1), appearance(LineupSlot.GK, 3, 0, 0))));
        assertThat(match.creditedQuarters(1)).isEqualTo(0.5);
        assertThat(match.creditedQuarters(2)).isEqualTo(0.5);
        assertThat(match.creditedQuarters(3)).isEqualTo(1);
        assertThat(match.creditedQuarters(99)).isZero();
        assertThat(match.getAppearances().stream().mapToInt(MatchAppearance::getGoals).sum()).isEqualTo(3);
    }
    @Test void rejectsSubstituteWithoutStarterAndRepeatEntryBySamePlayer() {
        var people = List.of(participant(1, Attendance.PRESENT));
        var sub = new MatchRequest.Appearance(LineupSlot.ST, 1L, 0, 0, 1);
        assertThatThrownBy(() -> MatchRecord.create(request(null, people, List.of(sub)))).hasMessageContaining("선발 선수");
        assertThatThrownBy(() -> MatchRecord.create(request(null, people, List.of(appearance(LineupSlot.ST, 1, 0, 0), sub)))).hasMessageContaining("같은 선수를 중복");
    }
}
