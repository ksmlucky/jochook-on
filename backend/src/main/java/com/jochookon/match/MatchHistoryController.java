package com.jochookon.match;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/matches/history")
public class MatchHistoryController {
    private final MatchHistoryService history;
    public MatchHistoryController(MatchHistoryService history) { this.history = history; }
    @GetMapping
    MatchHistory.Page list(@RequestParam(defaultValue = "0") @Min(0) int page,
                           @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size,
                           @RequestParam(required = false) @Min(1) Long matchId) {
        return history.list(page, size, matchId);
    }
    @GetMapping("/{eventId}")
    MatchHistory.Detail get(@PathVariable @Min(1) long eventId) { return history.get(eventId); }
}
