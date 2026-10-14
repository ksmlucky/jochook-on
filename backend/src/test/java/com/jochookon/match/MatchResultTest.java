package com.jochookon.match;

import static com.jochookon.match.MatchTestData.*;
import static org.assertj.core.api.Assertions.*;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class MatchResultTest {
    MatchRequest result(LocalTime time, Integer ours, Integer theirs) {
        var base = request(null, List.of(participant(1, Attendance.PRESENT)), List.of(appearance(LineupSlot.ST, 1, 2, 0)));
        return new MatchRequest(base.playedOn(), time, "", "", "", null, base.participants(), base.quarters(), List.of(), ours, theirs);
    }
    @Test void preservesUnknownAndZeroScoresAndAllowsUnattributedGoals() {
        var unknown = MatchRecord.create(result(LocalTime.of(11, 0), null, null));
        assertThat(unknown.getScoreFor()).isNull();
        var scoreless = MatchRecord.create(result(LocalTime.of(11, 30), 0, 0));
        assertThat(scoreless.getScoreFor()).isZero();
        var different = MatchRecord.create(result(LocalTime.of(0, 0), 3, 1));
        assertThat(different.getScoreFor()).isEqualTo(3);
        assertThat(different.getAppearances().getFirst().getGoals()).isEqualTo(2);
    }
    @Test void rejectsPartialOrInvalidScoresBeforeReplacingExistingData() {
        var saved = MatchRecord.create(result(LocalTime.of(11, 0), 2, 1));
        for (Integer[] values : new Integer[][] {{1, null}, {null, 0}, {-1, 0}, {0, 100}}) {
            assertThatThrownBy(() -> saved.replace(result(LocalTime.of(11, 0), values[0], values[1]))).hasMessageContaining("스코어");
            assertThat(saved.getScoreFor()).isEqualTo(2);
            assertThat(saved.getScoreAgainst()).isEqualTo(1);
        }
    }
    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {"11:15", "11:30:01", "11:30:00.1"})
    void rejectsMissingOrNonHalfHourKickoff(String time) {
        var parsed = time == null || time.isEmpty() ? null : LocalTime.parse(time);
        assertThatThrownBy(() -> MatchRecord.create(result(parsed, null, null))).hasMessageContaining("30분 단위");
    }
}
