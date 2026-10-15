package com.jochookon.match;

import com.jochookon.player.Player;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

public record MatchResponse(Long id, Long version, LocalDate playedOn, LocalTime kickoff, String venue,
                            String opponent, String notes, List<Participant> participants, List<MatchRequest.Quarter> quarters,
                            List<MatchRequest.PlannedEntry> plannedLineup, Integer scoreFor, Integer scoreAgainst, MatchKind kind,
                            RecordingStage recordingStage, Formation formationA, Formation formationB,
                            Long tournamentId, String tournamentName, TournamentStage tournamentStage, MatchFormat matchFormat) {
    public MatchResponse {
        matchFormat = MatchFormat.orDefault(matchFormat);
        formationA = Formation.orDefault(formationA); formationB = Formation.orDefault(formationB);
        // Old audit snapshots omit goal types. Responses display zero; request omission still means preserve.
        if (quarters != null) quarters = quarters.stream().map(q -> new MatchRequest.Quarter(q.number(), q.lineup().stream()
                .map(a -> a.withGoalTypes(a.freeKickGoals() == null ? 0 : a.freeKickGoals(),
                        a.penaltyGoals() == null ? 0 : a.penaltyGoals())).toList())).toList();
    }
    public MatchResponse(Long id, Long version, LocalDate playedOn, LocalTime kickoff, String venue,
                         String opponent, String notes, List<Participant> participants, List<MatchRequest.Quarter> quarters,
                         List<MatchRequest.PlannedEntry> plannedLineup, Integer scoreFor, Integer scoreAgainst, MatchKind kind,
                         RecordingStage recordingStage, Formation formationA, Formation formationB,
                         Long tournamentId, String tournamentName, TournamentStage tournamentStage) {
        this(id, version, playedOn, kickoff, venue, opponent, notes, participants, quarters, plannedLineup, scoreFor, scoreAgainst,
                kind, recordingStage, formationA, formationB, tournamentId, tournamentName, tournamentStage, MatchFormat.FOUR_QUARTERS);
    }
    public MatchResponse(Long id, Long version, LocalDate playedOn, LocalTime kickoff, String venue,
                         String opponent, String notes, List<Participant> participants, List<MatchRequest.Quarter> quarters,
                         List<MatchRequest.PlannedEntry> plannedLineup, Integer scoreFor, Integer scoreAgainst, MatchKind kind,
                         RecordingStage recordingStage, Formation formationA, Formation formationB) {
        this(id, version, playedOn, kickoff, venue, opponent, notes, participants, quarters, plannedLineup, scoreFor, scoreAgainst,
                kind, recordingStage, formationA, formationB, null, null, null);
    }
    public MatchResponse(Long id, Long version, LocalDate playedOn, LocalTime kickoff, String venue,
                         String opponent, String notes, List<Participant> participants, List<MatchRequest.Quarter> quarters,
                         List<MatchRequest.PlannedEntry> plannedLineup, Integer scoreFor, Integer scoreAgainst, MatchKind kind,
                         RecordingStage recordingStage) {
        this(id, version, playedOn, kickoff, venue, opponent, notes, participants, quarters, plannedLineup, scoreFor, scoreAgainst,
                kind, recordingStage, Formation.F4123, Formation.F4123);
    }
    public record Participant(Long playerId, String name, Integer shirtNumber, Vote vote, Attendance attendance, double creditedQuarters, Integer birthYear, com.jochookon.player.PlayerType playerType, MatchTeam plannedTeam) {
        public Participant(Long playerId, String name, Integer shirtNumber, Vote vote, Attendance attendance, double creditedQuarters, Integer birthYear, com.jochookon.player.PlayerType playerType) {
            this(playerId, name, shirtNumber, vote, attendance, creditedQuarters, birthYear, playerType, null);
        }
    }
    static MatchResponse from(MatchRecord match, Map<Long, Player> players) {
        return new MatchResponse(match.getId(), match.getVersion(), match.getPlayedOn(), match.getKickoff(), match.getVenue(),
                match.getOpponent(), match.getNotes(), match.getParticipants().stream().sorted(Comparator.comparing(MatchParticipant::getPlayerId))
                .map(p -> new Participant(p.getPlayerId(), players.get(p.getPlayerId()).getName(), players.get(p.getPlayerId()).getShirtNumber(), p.getVote(), p.getAttendance(), match.creditedQuarters(p.getPlayerId()), players.get(p.getPlayerId()).getBirthYear(), players.get(p.getPlayerId()).getPlayerType(), p.getPlannedTeam())).toList(),
                match.getQuarters().stream().sorted(Comparator.comparingInt(MatchQuarter::getNumber)).map(q -> new MatchRequest.Quarter(q.getNumber(),
                        match.getAppearances().stream().filter(a -> a.getQuarterNumber() == q.getNumber()).sorted(Comparator.comparing(MatchAppearance::getTeam).thenComparing(MatchAppearance::getSlot).thenComparingInt(MatchAppearance::getEntryOrder))
                                .map(a -> new MatchRequest.Appearance(a.getSlot(), a.getPlayerId(), a.getGoals(), a.getAssists(), a.getEntryOrder(), a.getTeam(), a.getFreeKickGoals(), a.getPenaltyGoals())).toList())).toList(), match.getPlannedLineup(), match.getScoreFor(), match.getScoreAgainst(), match.getKind(), match.getRecordingStage(), match.getFormationA(), match.getFormationB(), match.getTournamentId(), match.getTournamentName(), match.getTournamentStage(), match.getMatchFormat());
    }
    public record Scorer(Long playerId, String name, Integer shirtNumber, com.jochookon.player.PlayerType playerType,
                         long goals, long goalsA, long goalsB, long freeKickGoals, long penaltyGoals) {
        public Scorer(Long playerId, String name, Integer shirtNumber, com.jochookon.player.PlayerType playerType, long goals, long goalsA, long goalsB) {
            this(playerId, name, shirtNumber, playerType, goals, goalsA, goalsB, 0, 0);
        }
    }
    public record Summary(Long id, Long version, LocalDate playedOn, LocalTime kickoff, String venue, String opponent,
                          Integer scoreFor, Integer scoreAgainst, List<Scorer> scorers, int scorerCount, MatchKind kind, RecordingStage recordingStage, Formation formationA, Formation formationB,
                          Long tournamentId, String tournamentName, TournamentStage tournamentStage, MatchFormat matchFormat) {
        public Summary { matchFormat = MatchFormat.orDefault(matchFormat); }
        public Summary(Long id, Long version, LocalDate playedOn, LocalTime kickoff, String venue, String opponent,
                       Integer scoreFor, Integer scoreAgainst, List<Scorer> scorers, int scorerCount, MatchKind kind,
                       RecordingStage recordingStage, Formation formationA, Formation formationB,
                       Long tournamentId, String tournamentName, TournamentStage tournamentStage) {
            this(id, version, playedOn, kickoff, venue, opponent, scoreFor, scoreAgainst, scorers, scorerCount, kind,
                    recordingStage, formationA, formationB, tournamentId, tournamentName, tournamentStage, MatchFormat.FOUR_QUARTERS);
        }
        public Summary(Long id, Long version, LocalDate playedOn, LocalTime kickoff, String venue, String opponent,
                       Integer scoreFor, Integer scoreAgainst, List<Scorer> scorers, int scorerCount, MatchKind kind,
                       RecordingStage recordingStage, Formation formationA, Formation formationB) {
            this(id, version, playedOn, kickoff, venue, opponent, scoreFor, scoreAgainst, scorers, scorerCount, kind,
                    recordingStage, formationA, formationB, null, null, null);
        }
        public Summary(Long id, Long version, LocalDate playedOn, LocalTime kickoff, String venue, String opponent,
                       Integer scoreFor, Integer scoreAgainst, List<Scorer> scorers, int scorerCount, MatchKind kind, RecordingStage recordingStage) {
            this(id, version, playedOn, kickoff, venue, opponent, scoreFor, scoreAgainst, scorers, scorerCount, kind, recordingStage, Formation.F4123, Formation.F4123);
        }
        static Summary from(MatchRecord m, List<Scorer> allScorers) {
            var top = allScorers.stream().sorted(Comparator.comparing(Scorer::shirtNumber, Comparator.nullsLast(Integer::compareTo))
                    .thenComparing(Scorer::playerId)).limit(3).toList();
            return new Summary(m.getId(), m.getVersion(), m.getPlayedOn(), m.getKickoff(), m.getVenue(), m.getOpponent(),
                    m.getScoreFor(), m.getScoreAgainst(), top, allScorers.size(), m.getKind(), m.getRecordingStage(), m.getFormationA(), m.getFormationB(), m.getTournamentId(), m.getTournamentName(), m.getTournamentStage(), m.getMatchFormat());
        }
    }
    public record Page(List<Summary> items, int page, int totalPages, long totalElements, CompetitionScope competitionScope) {
        public Page(List<Summary> items, int page, int totalPages, long totalElements) {
            this(items, page, totalPages, totalElements, CompetitionScope.ALL);
        }
    }
}
