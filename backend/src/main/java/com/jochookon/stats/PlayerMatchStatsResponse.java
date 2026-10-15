package com.jochookon.stats;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import com.jochookon.match.CompetitionScope;

public record PlayerMatchStatsResponse(int year, StatsMatchKind kind, StatsRecordScope recordScope,
                                       boolean includeGuests, PlayerStatsResponse.Item player,
                                       int page, int size, long totalElements, long totalPages, List<Item> items, Long tournamentId,
                                       CompetitionScope competitionScope, Integer month, String startMonth, String endMonth, boolean allTime) {
    public PlayerMatchStatsResponse(int year, StatsMatchKind kind, StatsRecordScope recordScope,
                                    boolean includeGuests, PlayerStatsResponse.Item player,
                                    int page, int size, long totalElements, long totalPages, List<Item> items, Long tournamentId,
                                    CompetitionScope competitionScope, Integer month, String startMonth, String endMonth) {
        this(year, kind, recordScope, includeGuests, player, page, size, totalElements, totalPages, items, tournamentId, competitionScope,
                month, startMonth, endMonth, false);
    }
    public PlayerMatchStatsResponse(int year, StatsMatchKind kind, StatsRecordScope recordScope,
                                    boolean includeGuests, PlayerStatsResponse.Item player,
                                    int page, int size, long totalElements, long totalPages, List<Item> items, Long tournamentId,
                                    CompetitionScope competitionScope, Integer month) {
        this(year, kind, recordScope, includeGuests, player, page, size, totalElements, totalPages, items, tournamentId, competitionScope, month, null, null);
    }
    public PlayerMatchStatsResponse(int year, StatsMatchKind kind, StatsRecordScope recordScope,
                                    boolean includeGuests, PlayerStatsResponse.Item player,
                                    int page, int size, long totalElements, long totalPages, List<Item> items, Long tournamentId,
                                    CompetitionScope competitionScope) {
        this(year, kind, recordScope, includeGuests, player, page, size, totalElements, totalPages, items, tournamentId, competitionScope, null);
    }
    public PlayerMatchStatsResponse(int year, StatsMatchKind kind, StatsRecordScope recordScope,
                                    boolean includeGuests, PlayerStatsResponse.Item player,
                                    int page, int size, long totalElements, long totalPages, List<Item> items, Long tournamentId) {
        this(year, kind, recordScope, includeGuests, player, page, size, totalElements, totalPages, items, tournamentId, CompetitionScope.ALL);
    }
    public PlayerMatchStatsResponse(int year, StatsMatchKind kind, StatsRecordScope recordScope,
                                    boolean includeGuests, PlayerStatsResponse.Item player,
                                    int page, int size, long totalElements, long totalPages, List<Item> items) {
        this(year, kind, recordScope, includeGuests, player, page, size, totalElements, totalPages, items, null);
    }
    public record Item(long matchId, LocalDate playedOn, LocalTime kickoff, String opponent, String venue,
                       String kind, String recordingStage, Integer scoreFor, Integer scoreAgainst,
                       long goals, long assists, double creditedQuarters, boolean appeared, String attendance,
                       Long tournamentId, String tournamentName, String tournamentStage, long freeKickGoals, long penaltyGoals,
                       com.jochookon.match.MatchFormat matchFormat) {
        public Item { matchFormat = com.jochookon.match.MatchFormat.orDefault(matchFormat); }
        public Item(long matchId, LocalDate playedOn, LocalTime kickoff, String opponent, String venue,
                    String kind, String recordingStage, Integer scoreFor, Integer scoreAgainst,
                    long goals, long assists, double creditedQuarters, boolean appeared, String attendance,
                    Long tournamentId, String tournamentName, String tournamentStage, long freeKickGoals, long penaltyGoals) {
            this(matchId, playedOn, kickoff, opponent, venue, kind, recordingStage, scoreFor, scoreAgainst,
                    goals, assists, creditedQuarters, appeared, attendance, tournamentId, tournamentName, tournamentStage,
                    freeKickGoals, penaltyGoals, com.jochookon.match.MatchFormat.FOUR_QUARTERS);
        }
        public Item(long matchId, LocalDate playedOn, LocalTime kickoff, String opponent, String venue,
                    String kind, String recordingStage, Integer scoreFor, Integer scoreAgainst,
                    long goals, long assists, double creditedQuarters, boolean appeared, String attendance,
                    Long tournamentId, String tournamentName, String tournamentStage) {
            this(matchId, playedOn, kickoff, opponent, venue, kind, recordingStage, scoreFor, scoreAgainst,
                    goals, assists, creditedQuarters, appeared, attendance, tournamentId, tournamentName, tournamentStage, 0, 0);
        }
        public Item(long matchId, LocalDate playedOn, LocalTime kickoff, String opponent, String venue,
                    String kind, String recordingStage, Integer scoreFor, Integer scoreAgainst,
                    long goals, long assists, double creditedQuarters, boolean appeared, String attendance) {
            this(matchId, playedOn, kickoff, opponent, venue, kind, recordingStage, scoreFor, scoreAgainst,
                    goals, assists, creditedQuarters, appeared, attendance, null, null, null);
        }
        Item withKickoff(LocalTime time) {
            return new Item(matchId, playedOn, time, opponent, venue, kind, recordingStage, scoreFor, scoreAgainst,
                    goals, assists, creditedQuarters, appeared, attendance, tournamentId, tournamentName, tournamentStage, freeKickGoals, penaltyGoals, matchFormat);
        }
    }
}
