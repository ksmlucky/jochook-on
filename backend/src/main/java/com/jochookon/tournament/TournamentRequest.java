package com.jochookon.tournament;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record TournamentRequest(@NotBlank @Size(max = 120) String name,
                                @NotNull LocalDate startDate, @NotNull LocalDate endDate,
                                @Size(max = 120) String venue, @Size(max = 80) String division,
                                @Size(max = 3000) String notes, @PositiveOrZero Long version) {
    public TournamentRequest {
        venue = venue == null ? "" : venue;
        division = division == null ? "" : division;
        notes = notes == null ? "" : notes;
    }
    void validate() {
        if (name == null || name.isBlank() || name.length() > 120 || venue.length() > 120
                || division.length() > 80 || notes.length() > 3000)
            throw new IllegalArgumentException("대회명과 입력 길이를 확인해 주세요.");
        if (startDate == null || endDate == null || startDate.getYear() < 1000 || endDate.getYear() > 9999
                || endDate.isBefore(startDate))
            throw new IllegalArgumentException("대회 날짜는 1000~9999년이며 종료일은 시작일 이후여야 합니다.");
        if (version != null && version < 0) throw new IllegalArgumentException("수정 버전을 확인해 주세요.");
    }
}
