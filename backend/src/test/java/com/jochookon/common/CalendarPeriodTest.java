package com.jochookon.common;

import static org.assertj.core.api.Assertions.*;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class CalendarPeriodTest {
    @ParameterizedTest @CsvSource({"2024,2,2024-02-01,2024-02-29", "2025,2,2025-02-01,2025-02-28",
            "2026,4,2026-04-01,2026-04-30", "9999,12,9999-12-01,9999-12-31", "1000,1,1000-01-01,1000-01-31",
            "2024,,2024-01-01,2024-12-31"})
    void inclusiveBoundsRespectLeapYearsAndDatabaseExtremes(Integer year, Integer month, String from, String through) {
        assertThat(CalendarPeriod.of(year, month)).isEqualTo(new CalendarPeriod(LocalDate.parse(from), LocalDate.parse(through)));
    }
    @ParameterizedTest @CsvSource({",1", "999,1", "10000,1", "2026,0", "2026,13"})
    void rejectsInvalidYearOrMonth(Integer year, Integer month) {
        assertThatThrownBy(() -> CalendarPeriod.of(year, month)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void omittedYearAndMonthMeanNoDateFilter() { assertThat(CalendarPeriod.of(null, null)).isEqualTo(new CalendarPeriod(null, null)); }
    @ParameterizedTest @CsvSource({"2026-03,2026-06,2026-03-01,2026-06-30", "2023-12,2024-02,2023-12-01,2024-02-29",
            "1000-01,1000-01,1000-01-01,1000-01-31", "9999-12,9999-12,9999-12-01,9999-12-31"})
    void monthRangeIncludesBothEdgesAndCrossesYears(String start, String end, String from, String through) {
        assertThat(CalendarPeriod.of(null, null, start, end)).isEqualTo(new CalendarPeriod(LocalDate.parse(from), LocalDate.parse(through)));
    }
    @ParameterizedTest @CsvSource({"2026-03,", ",2026-06", "2026-06,2026-03", "0999-12,2026-01", "2026-01,10000-01",
            "2026-1,2026-06", "2026-00,2026-06", "2026-01,2026-13", "2026-01-01,2026-06", "'',2026-06"})
    void rejectsMalformedIncompleteAndReversedRanges(String start, String end) {
        assertThatThrownBy(() -> CalendarPeriod.of(null, null, start, end)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void rejectsAmbiguousLegacyAndRangeFilters() {
        assertThatThrownBy(() -> CalendarPeriod.of(2026, null, "2026-03", "2026-06")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> CalendarPeriod.of(null, 3, "2026-03", "2026-06")).isInstanceOf(IllegalArgumentException.class);
    }
}
