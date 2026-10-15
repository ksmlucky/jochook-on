package com.jochookon.match;

import java.util.List;

public record LineupSuggestion(String policyVersion, int seed, List<MatchRequest.PlannedEntry> plannedLineup,
        List<Allocation> allocations, List<String> warnings, boolean optimal, Formation formation, MatchFormat matchFormat) {
    public LineupSuggestion { matchFormat = MatchFormat.orDefault(matchFormat); }
    public LineupSuggestion(String policyVersion, int seed, List<MatchRequest.PlannedEntry> plannedLineup,
            List<Allocation> allocations, List<String> warnings, boolean optimal, Formation formation) {
        this(policyVersion, seed, plannedLineup, allocations, warnings, optimal, formation, MatchFormat.FOUR_QUARTERS);
    }
    public LineupSuggestion(String policyVersion, int seed, List<MatchRequest.PlannedEntry> plannedLineup,
            List<Allocation> allocations, List<String> warnings, boolean optimal) {
        this(policyVersion, seed, plannedLineup, allocations, warnings, optimal, Formation.F4123);
    }
    public record Allocation(long playerId, String group, long attended, long recorded, double quarters,
            List<Integer> restQuarters, int nonPreferredAppearances) { }
}
