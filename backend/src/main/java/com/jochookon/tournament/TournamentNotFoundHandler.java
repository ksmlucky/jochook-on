package com.jochookon.tournament;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Shared by tournament, match and stats endpoints, with one indistinguishable team-scoped 404. */
@RestControllerAdvice
public class TournamentNotFoundHandler {
    @ExceptionHandler(TournamentNotFoundException.class)
    ResponseEntity<?> missing(TournamentNotFoundException ex) {
        return ResponseEntity.status(404).body(Map.of("code", "TOURNAMENT_NOT_FOUND", "message", ex.getMessage(), "fieldErrors", Map.of()));
    }
}
