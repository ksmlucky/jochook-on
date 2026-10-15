package com.jochookon.stats;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.web.bind.annotation.GetMapping;
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
                                    @RequestParam(defaultValue = "false") boolean includeGuests) {
        return service.list(year, kind, recordScope, includeGuests);
    }
}
