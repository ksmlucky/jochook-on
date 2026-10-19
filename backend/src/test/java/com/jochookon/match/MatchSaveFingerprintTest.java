package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class MatchSaveFingerprintTest {
    private final JsonMapper json = JsonMapper.builder().build();
    @Test void goalTypeOmissionKeepsV24DigestButExplicitZeroAndChangedTypesHaveDistinctMeaning() throws Exception {
        var base = MatchTestData.request(null, List.of(MatchTestData.participant(1, Attendance.PRESENT)),
                List.of(MatchTestData.appearance(LineupSlot.ST, 1, 3, 0)));
        var oldTree = (tools.jackson.databind.node.ObjectNode) json.valueToTree(base);
        oldTree.remove("tournamentId"); oldTree.remove("tournamentStage"); oldTree.remove("tournamentSelectionSpecified");
        oldTree.remove("matchFormat");
        for (var quarter : oldTree.get("quarters")) {
            var q = (tools.jackson.databind.node.ObjectNode) quarter;
            q.remove("goalEvents"); q.remove("goalsAgainst"); q.remove("goalsAgainstSpecified");
        }
        for (var p : oldTree.get("participants")) {
            ((tools.jackson.databind.node.ObjectNode) p).remove("plannedTeam");
            ((tools.jackson.databind.node.ObjectNode) p).remove("plannedTeamSpecified");
        }
        var row = (tools.jackson.databind.node.ObjectNode) oldTree.get("quarters").get(0).get("lineup").get(0);
        row.remove("freeKickGoals"); row.remove("penaltyGoals");
        var digest = java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                .digest(json.writeValueAsString(oldTree).getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        assertThat(MatchSaveFingerprint.of(base, json)).isEqualTo(digest);
        var explicitZero = MatchTestData.request(null, base.participants(), List.of(base.quarters().getFirst().lineup().getFirst().withGoalTypes(0, 0)));
        var typed = MatchTestData.request(null, base.participants(), List.of(base.quarters().getFirst().lineup().getFirst().withGoalTypes(1, 2)));
        assertThat(MatchSaveFingerprint.of(explicitZero, json)).isNotEqualTo(digest);
        assertThat(MatchSaveFingerprint.of(typed, json)).isNotEqualTo(digest).isNotEqualTo(MatchSaveFingerprint.of(explicitZero, json));
        // The V24 tournament extension is kept in the same order when older requests replay.
        var linked = withTournament(base, 7L, TournamentStage.GROUP, true);
        oldTree.put("tournamentId", 7L); oldTree.put("tournamentStage", "GROUP"); oldTree.put("tournamentSelectionSpecified", true);
        var oldLinkedDigest = java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                .digest(json.writeValueAsString(oldTree).getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        assertThat(MatchSaveFingerprint.of(linked, json)).isEqualTo(oldLinkedDigest);
    }

    @Test void oldV23PayloadDigestIsUnchangedAndExplicitSelectionChangesTheReceipt() throws Exception {
        var base = MatchTestData.request(null, List.of(), List.of());
        // Fixed legacy field order and representation: this JSON is what V23 hashed before tournaments existed.
        String legacy = """
                {"playedOn":"2026-10-18","kickoff":"07:00:00","venue":"검증용 경기장","opponent":"검증용 상대","notes":"후반 압박 연습","version":null,"participants":[],"quarters":[{"number":1,"lineup":[]},{"number":2,"lineup":[]},{"number":3,"lineup":[]},{"number":4,"lineup":[]}],"plannedLineup":[],"scoreFor":null,"scoreAgainst":null,"kind":"EXTERNAL","recordingStage":null,"formationA":null,"formationB":null}
                """.strip();
        var digest = java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                .digest(legacy.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        assertThat(MatchSaveFingerprint.of(base, json)).isEqualTo(digest);
        assertThat(MatchSaveFingerprint.of(withTournament(base, null, null, false), json)).isEqualTo(digest);
        assertThat(MatchSaveFingerprint.of(withTournament(base, null, null, true), json)).isNotEqualTo(digest);
        var linked = withTournament(base, 3L, TournamentStage.GROUP, true);
        assertThat(MatchSaveFingerprint.of(linked, json)).isEqualTo(MatchSaveFingerprint.of(withTournament(base, 3L, TournamentStage.GROUP, null), json));
        assertThat(MatchSaveFingerprint.of(linked, json)).isNotEqualTo(MatchSaveFingerprint.of(withTournament(base, 3L, TournamentStage.FINAL, true), json));
        assertThat(MatchSaveFingerprint.of(linked, json)).isNotEqualTo(MatchSaveFingerprint.of(withTournament(base, 4L, TournamentStage.GROUP, true), json));
    }
    private MatchRequest withTournament(MatchRequest b, Long id, TournamentStage stage, Boolean specified) {
        return new MatchRequest(b.playedOn(), b.kickoff(), b.venue(), b.opponent(), b.notes(), b.version(), b.participants(),
                b.quarters(), b.plannedLineup(), b.scoreFor(), b.scoreAgainst(), b.kind(), b.recordingStage(),
                b.formationA(), b.formationB(), id, stage, specified);
    }

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
