package com.jochookon.tournament;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/tournaments")
public class TournamentController {
    private final TournamentService service;
    public TournamentController(TournamentService service) { this.service = service; }
    @GetMapping
    public TournamentResponse.Page list(@RequestParam(defaultValue = "0") @Min(0) int page,
                                         @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size,
                                         @RequestParam(required = false) @Min(1000) @Max(9999) Integer year,
                                         @RequestParam(required = false) @Min(1) @Max(12) Integer month,
                                         @RequestParam(required = false) String startMonth,
                                         @RequestParam(required = false) String endMonth) {
        com.jochookon.common.CalendarPeriod.of(year, month, startMonth, endMonth);
        if (startMonth != null || endMonth != null) return service.list(page, size, year, month, startMonth, endMonth);
        if (year != null) return service.list(page, size, year, month);
        return service.list(page, size);
    }
    @GetMapping("/years") public java.util.List<Integer> years() { return service.years(); }
    @GetMapping("/{id}") public TournamentResponse get(@PathVariable @Positive long id) { return service.get(id); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public TournamentResponse create(@Valid @RequestBody TournamentRequest request) { return service.create(request); }
    @PutMapping("/{id}")
    public TournamentResponse update(@PathVariable @Positive long id, @Valid @RequestBody TournamentRequest request) {
        return service.update(id, request);
    }
}
