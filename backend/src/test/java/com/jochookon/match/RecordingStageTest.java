package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class RecordingStageTest {
    private MatchRequest request(RecordingStage stage) {
        var base = MatchTestData.request(null, List.of(), List.of());
        return new MatchRequest(base.playedOn(), base.kickoff(), "", "", "", null,
                base.participants(), base.quarters(), List.of(), 0, 0, MatchKind.EXTERNAL, stage);
    }
    @Test void zeroScoreDoesNotAutomaticallyCompleteAndExplicitCompletionDoesNotRequireEverySlot() {
        var record = MatchRecord.create(request(null));
        assertThat(record.getRecordingStage()).isEqualTo(RecordingStage.ATTENDANCE);
        record.replace(request(RecordingStage.COMPLETED));
        assertThat(record.getRecordingStage()).isEqualTo(RecordingStage.COMPLETED);
        assertThat(record.getAppearances()).isEmpty();
        assertThat(record.getScoreFor()).isZero();
    }
    @Test void completedRecordCanReturnToAnyWritingStageAndOldClientPreservesCheckpoint() {
        var record = MatchRecord.create(request(RecordingStage.COMPLETED));
        for (var stage : RecordingStage.values()) {
            record.replace(request(stage));
            record.replace(request(null));
            assertThat(record.getRecordingStage()).isEqualTo(stage);
        }
    }
    @Test void legacyRecordKeepsUnknownStageUntilExplicitlySaved() {
        var legacy = new MatchRecord();
        legacy.replace(request(null));
        assertThat(legacy.getRecordingStage()).isNull();
        legacy.replace(request(RecordingStage.PLAN));
        assertThat(legacy.getRecordingStage()).isEqualTo(RecordingStage.PLAN);
    }
    @Test void oldAuditSnapshotsWithoutCheckpointStillDeserialize() {
        var oldSnapshot = """
                {"id":1,"version":0,"venue":"","opponent":"","notes":"",
                 "participants":[],"quarters":[],"plannedLineup":[],"kind":"EXTERNAL"}
                """;
        assertThat(new ObjectMapper().readValue(oldSnapshot, MatchResponse.class).recordingStage()).isNull();
    }
}
