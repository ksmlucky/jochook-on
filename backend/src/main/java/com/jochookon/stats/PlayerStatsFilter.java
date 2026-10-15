package com.jochookon.stats;

import java.time.LocalDate;
import java.util.Objects;
import com.jochookon.match.CompetitionScope;

record PlayerStatsFilter(int year, StatsMatchKind kind, StatsRecordScope recordScope,
                         boolean includeGuests, LocalDate today, Long tournamentId, CompetitionScope competitionScope, Integer month,
                         String startMonth, String endMonth, boolean allTime) {
    PlayerStatsFilter {
        if (year < 1000 || year > 9999) throw new IllegalArgumentException("시즌 연도는 1000~9999 사이여야 합니다.");
        Objects.requireNonNull(kind);
        Objects.requireNonNull(recordScope);
        Objects.requireNonNull(today);
        validateAllTime(allTime, null, month, startMonth, endMonth);
        if (!allTime) com.jochookon.common.CalendarPeriod.of(startMonth == null && endMonth == null ? year : null, month, startMonth, endMonth);
        validateCompetition(kind, tournamentId, competitionScope);
    }
    PlayerStatsFilter(int year, StatsMatchKind kind, StatsRecordScope scope, boolean guests, LocalDate today,
                      Long tournamentId, CompetitionScope competitionScope, Integer month, String startMonth, String endMonth) {
        this(year, kind, scope, guests, today, tournamentId, competitionScope, month, startMonth, endMonth, false);
    }
    static void validateAllTime(boolean allTime, Integer year, Integer month, String startMonth, String endMonth) {
        if (allTime && (year != null || month != null || startMonth != null || endMonth != null))
            throw new IllegalArgumentException("전체 기간 조회에는 연도·월·시작 연월·종료 연월을 함께 지정할 수 없습니다.");
    }
    PlayerStatsFilter(int year, StatsMatchKind kind, StatsRecordScope scope, boolean guests, LocalDate today,
                      Long tournamentId, CompetitionScope competitionScope, Integer month) {
        this(year, kind, scope, guests, today, tournamentId, competitionScope, month, null, null);
    }
    PlayerStatsFilter(int year, StatsMatchKind kind, StatsRecordScope scope, boolean guests, LocalDate today,
                      Long tournamentId, CompetitionScope competitionScope) {
        this(year, kind, scope, guests, today, tournamentId, competitionScope, null);
    }
    static void validateCompetition(StatsMatchKind kind, Long tournamentId, CompetitionScope competitionScope) {
        Objects.requireNonNull(competitionScope).validate(tournamentId);
        if (kind == StatsMatchKind.INTERNAL && (competitionScope == CompetitionScope.TOURNAMENT || tournamentId != null))
            throw new IllegalArgumentException("자체전은 대회 기록과 함께 조회할 수 없습니다.");
    }
    PlayerStatsFilter(int year, StatsMatchKind kind, StatsRecordScope scope, boolean guests, LocalDate today, Long tournamentId) {
        this(year, kind, scope, guests, today, tournamentId, CompetitionScope.ALL);
    }
    PlayerStatsFilter(int year, StatsMatchKind kind, StatsRecordScope scope, boolean guests, LocalDate today) {
        this(year, kind, scope, guests, today, null);
    }
    static PlayerStatsFilter of(Integer year, StatsMatchKind kind, StatsRecordScope scope,
                                boolean includeGuests, LocalDate today) {
        return new PlayerStatsFilter(year == null ? today.getYear() : year, kind, scope, includeGuests, today);
    }
    static PlayerStatsFilter of(Integer year, StatsMatchKind kind, StatsRecordScope scope,
                                boolean includeGuests, LocalDate today, Long tournamentId) {
        return new PlayerStatsFilter(year == null ? today.getYear() : year, kind, scope, includeGuests, today, tournamentId);
    }
    static PlayerStatsFilter of(Integer year, StatsMatchKind kind, StatsRecordScope scope,
                                boolean includeGuests, LocalDate today, Long tournamentId, CompetitionScope competitionScope) {
        return new PlayerStatsFilter(year == null ? today.getYear() : year, kind, scope, includeGuests, today, tournamentId, competitionScope);
    }
    static PlayerStatsFilter of(Integer year, StatsMatchKind kind, StatsRecordScope scope,
                                boolean includeGuests, LocalDate today, Long tournamentId, CompetitionScope competitionScope, Integer month) {
        return new PlayerStatsFilter(year == null ? today.getYear() : year, kind, scope, includeGuests, today, tournamentId, competitionScope, month);
    }
    static PlayerStatsFilter of(Integer year, StatsMatchKind kind, StatsRecordScope scope,
                                boolean includeGuests, LocalDate today, Long tournamentId, CompetitionScope competitionScope, Integer month,
                                String startMonth, String endMonth) {
        if (startMonth == null && endMonth == null) return of(year, kind, scope, includeGuests, today, tournamentId, competitionScope, month);
        var period = com.jochookon.common.CalendarPeriod.of(year, month, startMonth, endMonth);
        return new PlayerStatsFilter(period.from().getYear(), kind, scope, includeGuests, today, tournamentId, competitionScope, null, startMonth, endMonth);
    }
    static PlayerStatsFilter of(Integer year, StatsMatchKind kind, StatsRecordScope scope,
                                boolean includeGuests, LocalDate today, Long tournamentId, CompetitionScope competitionScope, Integer month,
                                String startMonth, String endMonth, boolean allTime) {
        validateAllTime(allTime, year, month, startMonth, endMonth);
        if (!allTime) return of(year, kind, scope, includeGuests, today, tournamentId, competitionScope, month, startMonth, endMonth);
        return new PlayerStatsFilter(today.getYear(), kind, scope, includeGuests, today, tournamentId, competitionScope, null, null, null, true);
    }
    private com.jochookon.common.CalendarPeriod period() {
        return com.jochookon.common.CalendarPeriod.of(startMonth == null && endMonth == null ? year : null, month, startMonth, endMonth);
    }
    // MySQL DATE supports 1000-01-01 onward; all-time includes the complete supported stored history.
    LocalDate from() { return allTime ? LocalDate.of(1000, 1, 1) : period().from(); }
    LocalDate through() {
        if (allTime) return today;
        var end = period().through();
        return end.isBefore(today) ? end : today;
    }
}
