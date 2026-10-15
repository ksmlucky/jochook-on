package com.jochookon.stats;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import com.jochookon.match.CompetitionScope;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/stats/players")
public class PlayerStatsController {
    private final PlayerStatsService service;
    public PlayerStatsController(PlayerStatsService service) { this.service = service; }

    @GetMapping
    public PlayerStatsResponse list(@RequestParam(required = false) @Min(1000) @Max(9999) Integer year,
                                    @RequestParam(defaultValue = "EXTERNAL") StatsMatchKind kind,
                                    @RequestParam(defaultValue = "COMPLETED") StatsRecordScope recordScope,
                                    @RequestParam(defaultValue = "false") boolean includeGuests,
                                    @RequestParam(required = false) @Min(1) Long tournamentId,
                                    @RequestParam(defaultValue = "ALL") CompetitionScope competitionScope,
                                    @RequestParam(required = false) @Min(1) @Max(12) Integer month,
                                    @RequestParam(required = false) String startMonth,
                                    @RequestParam(required = false) String endMonth,
                                    @RequestParam(defaultValue = "false") boolean allTime) {
        PlayerStatsFilter.validateCompetition(kind, tournamentId, competitionScope);
        PlayerStatsFilter.validateAllTime(allTime, year, month, startMonth, endMonth);
        if (allTime) return service.list(year, kind, recordScope, includeGuests, tournamentId, competitionScope, month, startMonth, endMonth, true);
        if (startMonth != null || endMonth != null) {
            com.jochookon.common.CalendarPeriod.of(year, month, startMonth, endMonth);
            return service.list(year, kind, recordScope, includeGuests, tournamentId, competitionScope, month, startMonth, endMonth);
        }
        if (month != null) return service.list(year, kind, recordScope, includeGuests, tournamentId, competitionScope, month);
        if (competitionScope != CompetitionScope.ALL) return service.list(year, kind, recordScope, includeGuests, tournamentId, competitionScope);
        return tournamentId == null ? service.list(year, kind, recordScope, includeGuests)
                : service.list(year, kind, recordScope, includeGuests, tournamentId);
    }

    @GetMapping("/{playerId}/matches")
    public PlayerMatchStatsResponse matches(@PathVariable @Min(1) long playerId,
                                            @RequestParam(required = false) @Min(1000) @Max(9999) Integer year,
                                            @RequestParam(defaultValue = "EXTERNAL") StatsMatchKind kind,
                                            @RequestParam(defaultValue = "COMPLETED") StatsRecordScope recordScope,
                                            @RequestParam(defaultValue = "false") boolean includeGuests,
                                            @RequestParam(defaultValue = "0") @Min(0) int page,
                                            @RequestParam(required = false) @Min(1) Long tournamentId,
                                            @RequestParam(defaultValue = "ALL") CompetitionScope competitionScope,
                                            @RequestParam(required = false) @Min(1) @Max(12) Integer month,
                                            @RequestParam(required = false) String startMonth,
                                            @RequestParam(required = false) String endMonth,
                                            @RequestParam(defaultValue = "false") boolean allTime) {
        PlayerStatsFilter.validateCompetition(kind, tournamentId, competitionScope);
        PlayerStatsFilter.validateAllTime(allTime, year, month, startMonth, endMonth);
        if (allTime) return service.matches(playerId, year, kind, recordScope, includeGuests, page, tournamentId, competitionScope, month, startMonth, endMonth, true);
        if (startMonth != null || endMonth != null) {
            com.jochookon.common.CalendarPeriod.of(year, month, startMonth, endMonth);
            return service.matches(playerId, year, kind, recordScope, includeGuests, page, tournamentId, competitionScope, month, startMonth, endMonth);
        }
        if (month != null) return service.matches(playerId, year, kind, recordScope, includeGuests, page, tournamentId, competitionScope, month);
        if (competitionScope != CompetitionScope.ALL) return service.matches(playerId, year, kind, recordScope, includeGuests, page, tournamentId, competitionScope);
        return tournamentId == null ? service.matches(playerId, year, kind, recordScope, includeGuests, page)
                : service.matches(playerId, year, kind, recordScope, includeGuests, page, tournamentId);
    }
}
