package com.jochookon.stats;

import java.util.List;

public record PlayerStatsResponse(int year, StatsMatchKind kind, StatsRecordScope recordScope,
                                  boolean includeGuests, List<Integer> availableYears,
                                  long matchCount, long completedMatchCount, long legacyMatchCount,
                                  long inProgressMatchCount, List<Item> items) {
    public record Item(long playerId, String name, Integer shirtNumber, Integer birthYear,
                       String playerType, boolean active, String firstChoice,
                       long goals, long assists, long appearances, long attendances, double creditedQuarters) { }
}
