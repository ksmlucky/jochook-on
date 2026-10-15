package com.jochookon.match;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.HashMap;

public record MatchRequest(
        @NotNull LocalDate playedOn, @NotNull(message = "시작 시간을 선택해 주세요.") LocalTime kickoff,
        @NotNull @Size(max = 100) String venue,
        @NotNull @Size(max = 100) String opponent,
        @NotNull @Size(max = 3000) String notes,
        @PositiveOrZero Long version,
        @NotNull @Size(max = 200) List<@NotNull @Valid Participant> participants,
        @NotNull @Size(min = 2, max = 4) List<@NotNull @Valid Quarter> quarters,
        @Size(max = 176) List<@NotNull @Valid PlannedEntry> plannedLineup,
        @Min(0) @Max(99) Integer scoreFor, @Min(0) @Max(99) Integer scoreAgainst, MatchKind kind,
        RecordingStage recordingStage, Formation formationA, Formation formationB,
        @Positive Long tournamentId, TournamentStage tournamentStage, Boolean tournamentSelectionSpecified, MatchFormat matchFormat) {
    public MatchRequest {
        plannedLineup = plannedLineup == null ? List.of() : plannedLineup;
        kind = kind == null ? MatchKind.EXTERNAL : kind;
    }
    public MatchRequest(LocalDate playedOn, LocalTime kickoff, String venue, String opponent, String notes,
                        Long version, List<Participant> participants, List<Quarter> quarters, List<PlannedEntry> plannedLineup,
                        Integer scoreFor, Integer scoreAgainst, MatchKind kind, RecordingStage recordingStage,
                        Formation formationA, Formation formationB, Long tournamentId, TournamentStage tournamentStage,
                        Boolean tournamentSelectionSpecified) {
        this(playedOn, kickoff, venue, opponent, notes, version, participants, quarters, plannedLineup, scoreFor,
                scoreAgainst, kind, recordingStage, formationA, formationB, tournamentId, tournamentStage, tournamentSelectionSpecified, null);
    }
    public MatchRequest(LocalDate playedOn, LocalTime kickoff, String venue, String opponent, String notes,
                        Long version, List<Participant> participants, List<Quarter> quarters, List<PlannedEntry> plannedLineup,
                        Integer scoreFor, Integer scoreAgainst, MatchKind kind, RecordingStage recordingStage,
                        Formation formationA, Formation formationB) {
        this(playedOn, kickoff, venue, opponent, notes, version, participants, quarters, plannedLineup, scoreFor,
                scoreAgainst, kind, recordingStage, formationA, formationB, null, null, null);
    }
    // Omission preserves old clients' saved links. Explicit null/null with true unlinks a tournament.
    public boolean changesTournament() {
        return Boolean.TRUE.equals(tournamentSelectionSpecified) || tournamentId != null || tournamentStage != null;
    }
    public MatchRequest(LocalDate playedOn, LocalTime kickoff, String venue, String opponent, String notes,
                        Long version, List<Participant> participants, List<Quarter> quarters, List<PlannedEntry> plannedLineup,
                        Integer scoreFor, Integer scoreAgainst, MatchKind kind, RecordingStage recordingStage) {
        this(playedOn, kickoff, venue, opponent, notes, version, participants, quarters, plannedLineup, scoreFor, scoreAgainst, kind, recordingStage, null, null);
    }
    MatchRequest resolveFormations(Formation savedA, Formation savedB) {
        return new MatchRequest(playedOn, kickoff, venue, opponent, notes, version, participants, quarters, plannedLineup,
                scoreFor, scoreAgainst, kind, recordingStage,
                formationA == null ? Formation.orDefault(savedA) : formationA,
                formationB == null ? Formation.orDefault(savedB) : formationB,
                tournamentId, tournamentStage, tournamentSelectionSpecified, matchFormat);
    }
    MatchRequest resolveMatchFormat(MatchFormat saved) {
        return new MatchRequest(playedOn, kickoff, venue, opponent, notes, version, participants, quarters, plannedLineup,
                scoreFor, scoreAgainst, kind, recordingStage, formationA, formationB, tournamentId, tournamentStage,
                tournamentSelectionSpecified, matchFormat == null ? MatchFormat.orDefault(saved) : matchFormat);
    }
    Formation formation(MatchTeam team) { return Formation.orDefault(team == MatchTeam.B ? formationB : formationA); }
    MatchRequest resolvePlannedTeams(List<MatchParticipant> saved) {
        var previous = new HashMap<Long, MatchTeam>();
        saved.forEach(p -> previous.put(p.getPlayerId(), p.getPlannedTeam()));
        var resolved = participants.stream().map(p -> p.changesPlannedTeam() ? p
                : new Participant(p.playerId(), p.vote(), p.attendance(), previous.get(p.playerId()), null)).toList();
        return new MatchRequest(playedOn, kickoff, venue, opponent, notes, version, resolved, quarters, plannedLineup,
                scoreFor, scoreAgainst, kind, recordingStage, formationA, formationB, tournamentId, tournamentStage, tournamentSelectionSpecified, matchFormat);
    }
    MatchRequest resolveGoalTypes(List<MatchAppearance> saved) {
        // A player has at most one appearance per quarter. Moving slots/teams must not erase their goal types.
        var previous = new HashMap<String, MatchAppearance>();
        saved.forEach(a -> previous.put(a.getQuarterNumber() + ":" + a.getPlayerId(), a));
        var resolved = quarters.stream().map(q -> new Quarter(q.number(), q.lineup().stream().map(a -> {
            var old = previous.get(q.number() + ":" + a.playerId());
            return a.withGoalTypes(a.freeKickGoals() == null ? old == null ? 0 : old.getFreeKickGoals() : a.freeKickGoals(),
                    a.penaltyGoals() == null ? old == null ? 0 : old.getPenaltyGoals() : a.penaltyGoals());
        }).toList())).toList();
        return new MatchRequest(playedOn, kickoff, venue, opponent, notes, version, participants, resolved, plannedLineup,
                scoreFor, scoreAgainst, kind, recordingStage, formationA, formationB, tournamentId, tournamentStage, tournamentSelectionSpecified, matchFormat);
    }
    public MatchRequest(LocalDate playedOn, LocalTime kickoff, String venue, String opponent, String notes,
                        Long version, List<Participant> participants, List<Quarter> quarters, List<PlannedEntry> plannedLineup,
                        Integer scoreFor, Integer scoreAgainst, MatchKind kind) {
        this(playedOn, kickoff, venue, opponent, notes, version, participants, quarters, plannedLineup, scoreFor, scoreAgainst, kind, null);
    }
    public MatchRequest(LocalDate playedOn, LocalTime kickoff, String venue, String opponent, String notes,
                        Long version, List<Participant> participants, List<Quarter> quarters, List<PlannedEntry> plannedLineup,
                        Integer scoreFor, Integer scoreAgainst) {
        this(playedOn, kickoff, venue, opponent, notes, version, participants, quarters, plannedLineup, scoreFor, scoreAgainst, MatchKind.EXTERNAL);
    }
    public MatchRequest(LocalDate playedOn, LocalTime kickoff, String venue, String opponent, String notes,
                        Long version, List<Participant> participants, List<Quarter> quarters) {
        this(playedOn, kickoff, venue, opponent, notes, version, participants, quarters, List.of(), null, null);
    }
    public MatchRequest(LocalDate playedOn, LocalTime kickoff, String venue, String opponent, String notes,
                        Long version, List<Participant> participants, List<Quarter> quarters, List<PlannedEntry> plannedLineup) {
        this(playedOn, kickoff, venue, opponent, notes, version, participants, quarters, plannedLineup, null, null);
    }
    public record PlannedEntry(@Min(1) @Max(4) int quarterNumber, @NotNull LineupSlot slot,
                               @Min(0) @Max(1) int entryOrder, @NotNull @Positive Long playerId, MatchTeam team) {
        public PlannedEntry { team = team == null ? MatchTeam.A : team; }
        public PlannedEntry(int quarterNumber, LineupSlot slot, int entryOrder, Long playerId) { this(quarterNumber, slot, entryOrder, playerId, MatchTeam.A); }
    }
    public record Participant(@NotNull @Positive Long playerId, @NotNull Vote vote, @NotNull Attendance attendance,
                              MatchTeam plannedTeam, Boolean plannedTeamSpecified) {
        public Participant(Long playerId, Vote vote, Attendance attendance) { this(playerId, vote, attendance, null, null); }
        public boolean changesPlannedTeam() { return Boolean.TRUE.equals(plannedTeamSpecified) || plannedTeam != null; }
    }
    public record Quarter(@Min(1) @Max(4) int number,
                          @NotNull @Size(max = 44) List<@NotNull @Valid Appearance> lineup) { }
    public record Appearance(@NotNull LineupSlot slot, @NotNull @Positive Long playerId,
                             @Min(0) @Max(99) int goals, @Min(0) @Max(99) int assists,
                             @Min(0) @Max(1) int entryOrder, MatchTeam team,
                             @Min(0) @Max(99) Integer freeKickGoals, @Min(0) @Max(99) Integer penaltyGoals) {
        public Appearance { team = team == null ? MatchTeam.A : team; }
        public Appearance(LineupSlot slot, Long playerId, int goals, int assists, int entryOrder, MatchTeam team) {
            this(slot, playerId, goals, assists, entryOrder, team, null, null);
        }
        public Appearance(LineupSlot slot, Long playerId, int goals, int assists, int entryOrder) { this(slot, playerId, goals, assists, entryOrder, MatchTeam.A); }
        public Appearance withGoalTypes(Integer freeKick, Integer penalty) {
            return new Appearance(slot, playerId, goals, assists, entryOrder, team, freeKick, penalty);
        }
    }
}
