package com.jochookon.match;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/matches/lineup-suggestion")
public class LineupSuggestionController {
    private final LineupSuggestionService service;
    public LineupSuggestionController(LineupSuggestionService service) { this.service = service; }
    @PostMapping LineupSuggestion suggest(@Valid @RequestBody LineupSuggestionRequest request) {
        return service.suggest(request);
    }
}
