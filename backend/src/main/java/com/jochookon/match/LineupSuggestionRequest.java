package com.jochookon.match;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;

public record LineupSuggestionRequest(
        @NotNull LocalDate playedOn,
        @NotNull @Size(min = 1, max = 200) List<@NotNull @Positive Long> playerIds,
        @Positive Long matchId,
        @Min(0) @Max(2147483647) int seed, Formation formation) {
    public LineupSuggestionRequest { formation = Formation.orDefault(formation); }
    public LineupSuggestionRequest(LocalDate playedOn, List<Long> playerIds, Long matchId, int seed) {
        this(playedOn, playerIds, matchId, seed, Formation.F4123);
    }
}
