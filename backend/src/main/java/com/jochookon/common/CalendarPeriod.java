package com.jochookon.common;

import java.time.LocalDate;
import java.time.YearMonth;

/** Inclusive SQL date bounds for a month range or the compatible single year/month filters. */
public record CalendarPeriod(LocalDate from, LocalDate through) {
    public static CalendarPeriod of(Integer year, Integer month, String startMonth, String endMonth) {
        if (startMonth == null && endMonth == null) return of(year, month);
        if (startMonth == null || endMonth == null)
            throw new IllegalArgumentException("시작 연월과 종료 연월을 함께 선택해 주세요.");
        if (year != null || month != null)
            throw new IllegalArgumentException("기간 조회와 단일 연도·월 조회를 동시에 지정할 수 없습니다.");
        var start = parseMonth(startMonth); var end = parseMonth(endMonth);
        if (start.isAfter(end)) throw new IllegalArgumentException("종료 연월은 시작 연월보다 빠를 수 없습니다.");
        return new CalendarPeriod(start.atDay(1), end.atEndOfMonth());
    }
    private static YearMonth parseMonth(String value) {
        if (!value.matches("[0-9]{4}-(0[1-9]|1[0-2])"))
            throw new IllegalArgumentException("연월은 YYYY-MM 형식으로 입력해 주세요.");
        var parsed = YearMonth.parse(value);
        if (parsed.getYear() < 1000 || parsed.getYear() > 9999)
            throw new IllegalArgumentException("조회 연월은 1000-01~9999-12 사이여야 합니다.");
        return parsed;
    }
    public static CalendarPeriod of(Integer year, Integer month) {
        if (year != null && (year < 1000 || year > 9999))
            throw new IllegalArgumentException("조회 연도는 1000~9999 사이여야 합니다.");
        if (month != null && (month < 1 || month > 12))
            throw new IllegalArgumentException("조회 월은 1~12 사이여야 합니다.");
        if (year == null) {
            if (month != null) throw new IllegalArgumentException("월을 조회하려면 연도를 함께 선택해 주세요.");
            return new CalendarPeriod(null, null);
        }
        return month == null ? new CalendarPeriod(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31))
                : new CalendarPeriod(YearMonth.of(year, month).atDay(1), YearMonth.of(year, month).atEndOfMonth());
    }
}
