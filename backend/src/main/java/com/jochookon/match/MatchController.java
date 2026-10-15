package com.jochookon.match;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/matches")
public class MatchController {
    private final MatchService service;
    private final MatchSaveService saves;
    public MatchController(MatchService service, MatchSaveService saves) { this.service = service; this.saves = saves; }
    @GetMapping
    MatchResponse.Page list(@RequestParam(defaultValue = "0") @Min(0) int page,
                            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size,
                            @RequestParam(required = false) @Min(1) Long tournamentId,
                            @RequestParam(defaultValue = "ALL") CompetitionScope competitionScope,
                            @RequestParam(required = false) @Min(1000) @Max(9999) Integer year,
                            @RequestParam(required = false) @Min(1) @Max(12) Integer month,
                            @RequestParam(required = false) String startMonth,
                            @RequestParam(required = false) String endMonth) {
        competitionScope.validate(tournamentId);
        com.jochookon.common.CalendarPeriod.of(year, month, startMonth, endMonth);
        if (startMonth != null || endMonth != null) return service.list(page, size, tournamentId, competitionScope, year, month, startMonth, endMonth);
        if (year != null) return service.list(page, size, tournamentId, competitionScope, year, month);
        if (competitionScope != CompetitionScope.ALL) return service.list(page, size, tournamentId, competitionScope);
        return tournamentId == null ? service.list(page, size) : service.list(page, size, tournamentId);
    }
    @GetMapping("/years")
    java.util.List<Integer> years() { return service.years(); }
    @GetMapping("/{id}")
    MatchResponse get(@PathVariable @Min(1) long id) { return service.get(id); }
    @PostMapping
    ResponseEntity<MatchResponse> create(@Valid @RequestBody MatchRequest request,
                                        @RequestHeader(value = "Idempotency-Key", required = false) UUID key) {
        var match = key == null ? service.create(request) : saves.save(key, null, request);
        return ResponseEntity.created(URI.create("/api/v1/matches/" + match.id())).body(match);
    }
    @PutMapping("/{id}")
    MatchResponse update(@PathVariable @Min(1) long id, @Valid @RequestBody MatchRequest request,
                         @RequestHeader(value = "Idempotency-Key", required = false) UUID key) {
        return key == null ? service.update(id, request) : saves.save(key, id, request);
    }
    @GetMapping("/save-requests/{key}")
    MatchSaveService.Status saveStatus(@PathVariable UUID key) { return saves.status(key); }
    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable @Min(1) long id, @RequestParam @Min(0) long version) {
        service.delete(id, version);
        return ResponseEntity.noContent().build();
    }
}
