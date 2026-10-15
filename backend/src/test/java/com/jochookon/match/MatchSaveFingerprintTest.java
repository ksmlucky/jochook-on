package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class MatchSaveFingerprintTest {
    private final JsonMapper json = JsonMapper.builder().build();

    @Test void normalizesOrderDefaultsAndStoredWhitespaceWithoutMutatingInput() {
        var a = MatchTestData.appearance(LineupSlot.ST, 1, 2, 1);
        var b = MatchTestData.appearance(LineupSlot.LW, 2, 0, 0);
        var base = MatchTestData.request(null, List.of(MatchTestData.participant(1, Attendance.PRESENT),
                MatchTestData.participant(2, Attendance.LATE)), List.of(a, b));
        var quarters = new ArrayList<>(base.quarters());
        quarters.set(0, new MatchRequest.Quarter(1, List.of(b, a)));
        Collections.reverse(quarters);
        var shuffled = new MatchRequest(base.playedOn(), base.kickoff(), " " + base.venue() + " ", base.opponent(), base.notes(),
                null, base.participants().reversed(), quarters, null, null, null, null);
        assertThat(MatchSaveFingerprint.of(shuffled, json)).isEqualTo(MatchSaveFingerprint.of(base, json)).hasSize(64);
        assertThat(base.quarters().getFirst().lineup()).containsExactly(a, b);
    }

    @Test void changedStatsVersionStageAndFormationDoNotReplayAnotherRequest() {
        var base = MatchTestData.request(null, List.of(MatchTestData.participant(1, Attendance.PRESENT)),
                List.of(MatchTestData.appearance(LineupSlot.ST, 1, 0, 0)));
        var changedStats = MatchTestData.request(null, base.participants(), List.of(MatchTestData.appearance(LineupSlot.ST, 1, 1, 0)));
        var changedVersion = MatchTestData.request(0L, base.participants(), base.quarters().getFirst().lineup());
        var changedStage = new MatchRequest(base.playedOn(), base.kickoff(), base.venue(), base.opponent(), base.notes(), null,
                base.participants(), base.quarters(), base.plannedLineup(), null, null, base.kind(), RecordingStage.COMPLETED);
        var changedFormation = base.resolveFormations(Formation.F442, Formation.F4123);
        for (var changed : List.of(changedStats, changedVersion, changedStage, changedFormation))
            assertThat(MatchSaveFingerprint.of(changed, json)).isNotEqualTo(MatchSaveFingerprint.of(base, json));
    }
}
