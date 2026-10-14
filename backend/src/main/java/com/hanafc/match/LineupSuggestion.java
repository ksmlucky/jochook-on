package com.hanafc.match;

import java.util.List;

public record LineupSuggestion(String policyVersion, int seed, List<MatchRequest.PlannedEntry> plannedLineup,
        List<Allocation> allocations, List<String> warnings, boolean optimal) {
    public record Allocation(long playerId, String group, long attended, long recorded, double quarters,
            List<Integer> restQuarters, int nonPreferredAppearances) { }
}
