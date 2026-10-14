package com.hanafc.match;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/matches")
public class MatchController {
    private final MatchService service;
    public MatchController(MatchService service) { this.service = service; }
    @GetMapping
    MatchResponse.Page list(@RequestParam(defaultValue = "0") @Min(0) int page,
                            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size) { return service.list(page, size); }
    @GetMapping("/{id}")
    MatchResponse get(@PathVariable @Min(1) long id) { return service.get(id); }
    @PostMapping
    ResponseEntity<MatchResponse> create(@Valid @RequestBody MatchRequest request) {
        var match = service.create(request);
        return ResponseEntity.created(URI.create("/api/v1/matches/" + match.id())).body(match);
    }
    @PutMapping("/{id}")
    MatchResponse update(@PathVariable @Min(1) long id, @Valid @RequestBody MatchRequest request) { return service.update(id, request); }
}
