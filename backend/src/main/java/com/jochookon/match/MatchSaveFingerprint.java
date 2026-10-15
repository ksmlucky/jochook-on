package com.jochookon.match;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.HexFormat;
import tools.jackson.databind.ObjectMapper;

/** Only a digest is retained; names, notes and the request body never enter the receipt table. */
final class MatchSaveFingerprint {
    private MatchSaveFingerprint() { }

    static String of(MatchRequest request, ObjectMapper json) {
        var appearances = Comparator.comparing(MatchRequest.Appearance::team)
                .thenComparing(MatchRequest.Appearance::slot).thenComparingInt(MatchRequest.Appearance::entryOrder)
                .thenComparing(MatchRequest.Appearance::playerId).thenComparingInt(MatchRequest.Appearance::goals)
                .thenComparingInt(MatchRequest.Appearance::assists);
        var plans = Comparator.comparingInt(MatchRequest.PlannedEntry::quarterNumber)
                .thenComparing(MatchRequest.PlannedEntry::team).thenComparing(MatchRequest.PlannedEntry::slot)
                .thenComparingInt(MatchRequest.PlannedEntry::entryOrder).thenComparing(MatchRequest.PlannedEntry::playerId);
        var normalized = new MatchRequest(request.playedOn(), request.kickoff(), request.venue().strip(),
                request.opponent().strip(), request.notes().strip(), request.version(),
                request.participants().stream().sorted(Comparator.comparing(MatchRequest.Participant::playerId)
                        .thenComparing(MatchRequest.Participant::vote).thenComparing(MatchRequest.Participant::attendance)).toList(),
                request.quarters().stream().map(q -> new MatchRequest.Quarter(q.number(), q.lineup().stream().sorted(appearances).toList()))
                        .sorted(Comparator.comparingInt(MatchRequest.Quarter::number)).toList(),
                request.plannedLineup().stream().sorted(plans).toList(), request.scoreFor(), request.scoreAgainst(),
                request.kind(), request.recordingStage(), request.formationA(), request.formationB());
        // Keep the exact V23 serialization for omitted tournament selection so old receipts replay.
        var body = (tools.jackson.databind.node.ObjectNode) json.valueToTree(normalized);
        for (var participant : body.get("participants")) {
            var entry = (tools.jackson.databind.node.ObjectNode) participant;
            boolean specified = entry.get("plannedTeamSpecified").asBoolean(false) || !entry.get("plannedTeam").isNull();
            entry.remove("plannedTeamSpecified");
            if (!specified) entry.remove("plannedTeam");
            else entry.put("plannedTeamSpecified", true);
        }
        for (var quarter : body.get("quarters")) for (var appearance : quarter.get("lineup")) {
            var entry = (tools.jackson.databind.node.ObjectNode) appearance;
            if (entry.get("freeKickGoals").isNull()) entry.remove("freeKickGoals");
            if (entry.get("penaltyGoals").isNull()) entry.remove("penaltyGoals");
        }
        body.remove("tournamentId"); body.remove("tournamentStage"); body.remove("tournamentSelectionSpecified");
        body.remove("matchFormat");
        if (request.changesTournament()) {
            body.set("tournamentId", json.valueToTree(request.tournamentId()));
            body.set("tournamentStage", json.valueToTree(request.tournamentStage()));
            body.put("tournamentSelectionSpecified", true);
        }
        if (request.matchFormat() != null) body.set("matchFormat", json.valueToTree(request.matchFormat()));
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(json.writeValueAsString(body).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
}
