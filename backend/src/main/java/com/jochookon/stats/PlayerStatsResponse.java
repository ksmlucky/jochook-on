package com.jochookon.stats;

import java.util.List;
import com.jochookon.match.CompetitionScope;

public record PlayerStatsResponse(int year, StatsMatchKind kind, StatsRecordScope recordScope,
                                  boolean includeGuests, List<Integer> availableYears,
                                  long matchCount, long completedMatchCount, long legacyMatchCount,
                                  long inProgressMatchCount, List<Item> items, Long tournamentId, CompetitionScope competitionScope, Integer month,
                                  String startMonth, String endMonth, Long goalsAgainst, long scoredExternalMatchCount,
                                  long missingExternalScoreCount, long excludedInternalMatchCount, long externalMatchCount, long internalMatchCount, boolean allTime) {
    public PlayerStatsResponse(int year, StatsMatchKind kind, StatsRecordScope recordScope,
                               boolean includeGuests, List<Integer> availableYears, long matchCount,
                               long completedMatchCount, long legacyMatchCount, long inProgressMatchCount, List<Item> items,
                               Long tournamentId, CompetitionScope competitionScope, Integer month, String startMonth, String endMonth,
                               Long goalsAgainst, long scoredExternalMatchCount, long missingExternalScoreCount,
                               long excludedInternalMatchCount, long externalMatchCount, long internalMatchCount) {
        this(year, kind, recordScope, includeGuests, availableYears, matchCount, completedMatchCount, legacyMatchCount,
                inProgressMatchCount, items, tournamentId, competitionScope, month, startMonth, endMonth, goalsAgainst,
                scoredExternalMatchCount, missingExternalScoreCount, excludedInternalMatchCount, externalMatchCount, internalMatchCount, false);
    }
    public PlayerStatsResponse(int year, StatsMatchKind kind, StatsRecordScope recordScope,
                               boolean includeGuests, List<Integer> availableYears, long matchCount,
                               long completedMatchCount, long legacyMatchCount, long inProgressMatchCount, List<Item> items,
                               Long tournamentId, CompetitionScope competitionScope, Integer month, String startMonth, String endMonth) {
        this(year, kind, recordScope, includeGuests, availableYears, matchCount, completedMatchCount, legacyMatchCount,
                inProgressMatchCount, items, tournamentId, competitionScope, month, startMonth, endMonth, null, 0, 0, 0, 0, 0);
    }
    public PlayerStatsResponse(int year, StatsMatchKind kind, StatsRecordScope recordScope,
                               boolean includeGuests, List<Integer> availableYears, long matchCount,
                               long completedMatchCount, long legacyMatchCount, long inProgressMatchCount, List<Item> items,
                               Long tournamentId, CompetitionScope competitionScope, Integer month) {
        this(year, kind, recordScope, includeGuests, availableYears, matchCount, completedMatchCount, legacyMatchCount,
                inProgressMatchCount, items, tournamentId, competitionScope, month, null, null);
    }
    public PlayerStatsResponse(int year, StatsMatchKind kind, StatsRecordScope recordScope,
                               boolean includeGuests, List<Integer> availableYears, long matchCount,
                               long completedMatchCount, long legacyMatchCount, long inProgressMatchCount, List<Item> items,
                               Long tournamentId, CompetitionScope competitionScope) {
        this(year, kind, recordScope, includeGuests, availableYears, matchCount, completedMatchCount, legacyMatchCount,
                inProgressMatchCount, items, tournamentId, competitionScope, null);
    }
    public PlayerStatsResponse(int year, StatsMatchKind kind, StatsRecordScope recordScope,
                               boolean includeGuests, List<Integer> availableYears, long matchCount,
                               long completedMatchCount, long legacyMatchCount, long inProgressMatchCount, List<Item> items, Long tournamentId) {
        this(year, kind, recordScope, includeGuests, availableYears, matchCount, completedMatchCount, legacyMatchCount,
                inProgressMatchCount, items, tournamentId, CompetitionScope.ALL);
    }
    public PlayerStatsResponse(int year, StatsMatchKind kind, StatsRecordScope recordScope,
                               boolean includeGuests, List<Integer> availableYears, long matchCount,
                               long completedMatchCount, long legacyMatchCount, long inProgressMatchCount, List<Item> items) {
        this(year, kind, recordScope, includeGuests, availableYears, matchCount, completedMatchCount, legacyMatchCount,
                inProgressMatchCount, items, null);
    }
    public record Item(long playerId, String name, Integer shirtNumber, Integer birthYear,
                       String playerType, boolean active, String firstChoice,
                       long goals, long assists, long appearances, long attendances, double creditedQuarters,
                       long freeKickGoals, long penaltyGoals) {
        public Item(long playerId, String name, Integer shirtNumber, Integer birthYear, String playerType, boolean active,
                    String firstChoice, long goals, long assists, long appearances, long attendances, double creditedQuarters) {
            this(playerId, name, shirtNumber, birthYear, playerType, active, firstChoice, goals, assists, appearances, attendances, creditedQuarters, 0, 0);
        }
    }
}
