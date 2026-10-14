package com.hanafc.player;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/players/guests")
public class GuestPlayerController {
    private final PlayerQueryService queries;
    private final PlayerCommandService commands;
    public GuestPlayerController(PlayerQueryService queries, PlayerCommandService commands) { this.queries = queries; this.commands = commands; }
    @GetMapping PlayerPageResponse list(@RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "100") @Min(1) @Max(100) int size) {
        return queries.findActivePlayers(page, size, "name", "asc", PlayerType.GUEST);
    }
    @PostMapping ResponseEntity<PlayerResponse> create(@Valid @RequestBody GuestPlayerRequest request) {
        var guest = commands.createGuest(request);
        return ResponseEntity.created(URI.create("/api/v1/players/" + guest.id())).body(guest);
    }
}
