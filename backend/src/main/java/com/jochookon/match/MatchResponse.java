package com.jochookon.match;

import com.jochookon.player.Player;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

public record MatchResponse(Long id, Long version, LocalDate playedOn, LocalTime kickoff, String venue,
                            String opponent, String notes, List<Participant> participants, List<MatchRequest.Quarter> quarters,
                            List<MatchRequest.PlannedEntry> plannedLineup, Integer scoreFor, Integer scoreAgainst, MatchKind kind,
                            RecordingStage recordingStage, Formation formationA, Formation formationB) {
    public MatchResponse {
        formationA = Formation.orDefault(formationA); formationB = Formation.orDefault(formationB);
    }
    public MatchResponse(Long id, Long version, LocalDate playedOn, LocalTime kickoff, String venue,
                         String opponent, String notes, List<Participant> participants, List<MatchRequest.Quarter> quarters,
                         List<MatchRequest.PlannedEntry> plannedLineup, Integer scoreFor, Integer scoreAgainst, MatchKind kind,
                         RecordingStage recordingStage) {
        this(id, version, playedOn, kickoff, venue, opponent, notes, participants, quarters, plannedLineup, scoreFor, scoreAgainst,
                kind, recordingStage, Formation.F4123, Formation.F4123);
    }
    public record Participant(Long playerId, String name, Integer shirtNumber, Vote vote, Attendance attendance, double creditedQuarters, Integer birthYear, com.jochookon.player.PlayerType playerType) { }
    static MatchResponse from(MatchRecord match, Map<Long, Player> players) {
        return new MatchResponse(match.getId(), match.getVersion(), match.getPlayedOn(), match.getKickoff(), match.getVenue(),
                match.getOpponent(), match.getNotes(), match.getParticipants().stream().sorted(Comparator.comparing(MatchParticipant::getPlayerId))
                .map(p -> new Participant(p.getPlayerId(), players.get(p.getPlayerId()).getName(), players.get(p.getPlayerId()).getShirtNumber(), p.getVote(), p.getAttendance(), match.creditedQuarters(p.getPlayerId()), players.get(p.getPlayerId()).getBirthYear(), players.get(p.getPlayerId()).getPlayerType())).toList(),
                match.getQuarters().stream().sorted(Comparator.comparingInt(MatchQuarter::getNumber)).map(q -> new MatchRequest.Quarter(q.getNumber(),
                        match.getAppearances().stream().filter(a -> a.getQuarterNumber() == q.getNumber()).sorted(Comparator.comparing(MatchAppearance::getTeam).thenComparing(MatchAppearance::getSlot).thenComparingInt(MatchAppearance::getEntryOrder))
                                .map(a -> new MatchRequest.Appearance(a.getSlot(), a.getPlayerId(), a.getGoals(), a.getAssists(), a.getEntryOrder(), a.getTeam())).toList())).toList(), match.getPlannedLineup(), match.getScoreFor(), match.getScoreAgainst(), match.getKind(), match.getRecordingStage(), match.getFormationA(), match.getFormationB());
    }
    public record Scorer(Long playerId, String name, Integer shirtNumber, com.jochookon.player.PlayerType playerType, long goals, long goalsA, long goalsB) { }
    public record Summary(Long id, Long version, LocalDate playedOn, LocalTime kickoff, String venue, String opponent,
                          Integer scoreFor, Integer scoreAgainst, List<Scorer> scorers, int scorerCount, MatchKind kind, RecordingStage recordingStage, Formation formationA, Formation formationB) {
        public Summary(Long id, Long version, LocalDate playedOn, LocalTime kickoff, String venue, String opponent,
                       Integer scoreFor, Integer scoreAgainst, List<Scorer> scorers, int scorerCount, MatchKind kind, RecordingStage recordingStage) {
            this(id, version, playedOn, kickoff, venue, opponent, scoreFor, scoreAgainst, scorers, scorerCount, kind, recordingStage, Formation.F4123, Formation.F4123);
        }
        static Summary from(MatchRecord m, List<Scorer> allScorers) {
            var top = allScorers.stream().sorted(Comparator.comparing(Scorer::shirtNumber, Comparator.nullsLast(Integer::compareTo))
                    .thenComparing(Scorer::playerId)).limit(3).toList();
            return new Summary(m.getId(), m.getVersion(), m.getPlayedOn(), m.getKickoff(), m.getVenue(), m.getOpponent(),
                    m.getScoreFor(), m.getScoreAgainst(), top, allScorers.size(), m.getKind(), m.getRecordingStage(), m.getFormationA(), m.getFormationB());
        }
    }
    public record Page(List<Summary> items, int page, int totalPages, long totalElements) { }
}
