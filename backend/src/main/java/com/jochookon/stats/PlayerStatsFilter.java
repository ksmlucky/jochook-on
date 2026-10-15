package com.jochookon.stats;

import java.time.LocalDate;
import java.util.Objects;

record PlayerStatsFilter(int year, StatsMatchKind kind, StatsRecordScope recordScope,
                         boolean includeGuests, LocalDate today) {
    PlayerStatsFilter {
        if (year < 1000 || year > 9999) throw new IllegalArgumentException("시즌 연도는 1000~9999 사이여야 합니다.");
        Objects.requireNonNull(kind);
        Objects.requireNonNull(recordScope);
        Objects.requireNonNull(today);
    }
    static PlayerStatsFilter of(Integer year, StatsMatchKind kind, StatsRecordScope scope,
                                boolean includeGuests, LocalDate today) {
        return new PlayerStatsFilter(year == null ? today.getYear() : year, kind, scope, includeGuests, today);
    }
    LocalDate from() { return LocalDate.of(year, 1, 1); }
    LocalDate through() {
        var end = LocalDate.of(year, 12, 31);
        return end.isBefore(today) ? end : today;
    }
}
