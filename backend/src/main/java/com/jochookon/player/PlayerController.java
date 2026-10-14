package com.jochookon.player;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/players")
public class PlayerController {
    private final PlayerQueryService playerQueryService;
    private final PlayerCommandService playerCommandService;

    public PlayerController(PlayerQueryService playerQueryService, PlayerCommandService playerCommandService) {
        this.playerQueryService = playerQueryService;
        this.playerCommandService = playerCommandService;
    }

    @GetMapping
    PlayerPageResponse findPlayers(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(defaultValue = "id") @Pattern(regexp = "id|shirtNumber|age|name|preferredPosition") String sort,
            @RequestParam(defaultValue = "asc") @Pattern(regexp = "asc|desc") String direction,
            @RequestParam(defaultValue = "") @Pattern(regexp = "|UNDER_20|20|30|40|50|60|70|80|90|100_PLUS|UNKNOWN") String ageGroup,
            @RequestParam(defaultValue = "") @Pattern(regexp = "|정회원|코치|감독|총무|회장") String clubRole,
            @RequestParam(defaultValue = "") @Pattern(regexp = "|GK|LB|CB|RB|CDM|CM|LW|ST|RW|UNKNOWN") String firstChoice,
            @RequestParam(defaultValue = "") @Pattern(regexp = "|FW|MF|DF|GK") String positionGroup) {
        return playerQueryService.findActivePlayers(page, size, sort, direction, ageGroup, clubRole, firstChoice, positionGroup);
    }

    @GetMapping("/{id}")
    PlayerResponse findPlayer(@PathVariable @Min(1) long id) {
        return playerQueryService.findActivePlayer(id);
    }

    @PostMapping
    ResponseEntity<PlayerResponse> create(@Valid @RequestBody CreatePlayerRequest request) {
        PlayerResponse player = playerCommandService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/players/" + player.id())).body(player);
    }

    @PutMapping("/{id}")
    PlayerResponse update(@PathVariable @Min(1) long id, @Valid @RequestBody UpdatePlayerRequest request) {
        return playerCommandService.update(id, request);
    }
}
