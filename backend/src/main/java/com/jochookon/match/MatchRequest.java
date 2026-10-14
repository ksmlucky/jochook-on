package com.jochookon.match;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record MatchRequest(
        @NotNull LocalDate playedOn, @NotNull(message = "시작 시간을 선택해 주세요.") LocalTime kickoff,
        @NotNull @Size(max = 100) String venue,
        @NotNull @Size(max = 100) String opponent,
        @NotNull @Size(max = 3000) String notes,
        @PositiveOrZero Long version,
        @NotNull @Size(max = 200) List<@NotNull @Valid Participant> participants,
        @NotNull @Size(min = 4, max = 4) List<@NotNull @Valid Quarter> quarters,
        @Size(max = 176) List<@NotNull @Valid PlannedEntry> plannedLineup,
        @Min(0) @Max(99) Integer scoreFor, @Min(0) @Max(99) Integer scoreAgainst, MatchKind kind,
        RecordingStage recordingStage) {
    public MatchRequest {
        plannedLineup = plannedLineup == null ? List.of() : plannedLineup;
        kind = kind == null ? MatchKind.EXTERNAL : kind;
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
    public record Participant(@NotNull @Positive Long playerId, @NotNull Vote vote, @NotNull Attendance attendance) { }
    public record Quarter(@Min(1) @Max(4) int number,
                          @NotNull @Size(max = 44) List<@NotNull @Valid Appearance> lineup) { }
    public record Appearance(@NotNull LineupSlot slot, @NotNull @Positive Long playerId,
                             @Min(0) @Max(99) int goals, @Min(0) @Max(99) int assists,
                             @Min(0) @Max(1) int entryOrder, MatchTeam team) {
        public Appearance { team = team == null ? MatchTeam.A : team; }
        public Appearance(LineupSlot slot, Long playerId, int goals, int assists, int entryOrder) { this(slot, playerId, goals, assists, entryOrder, MatchTeam.A); }
    }
}
