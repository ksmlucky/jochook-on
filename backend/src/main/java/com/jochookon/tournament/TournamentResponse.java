package com.jochookon.tournament;

import java.time.LocalDate;
import java.util.List;

public record TournamentResponse(Long id, Long version, String name, LocalDate startDate, LocalDate endDate,
                                 String venue, String division, String notes, long matchCount) {
    static TournamentResponse from(Tournament t, long count) {
        return new TournamentResponse(t.getId(), t.getVersion(), t.getName(), t.getStartDate(), t.getEndDate(),
                t.getVenue(), t.getDivision(), t.getNotes(), count);
    }
    public record Page(List<TournamentResponse> items, int page, int totalPages, long totalElements) { }
}
