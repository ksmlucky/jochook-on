package com.jochookon.player;

import java.util.List;
import org.springframework.data.domain.Page;

public record PlayerPageResponse(
        List<PlayerResponse> items, int page, int size, long totalElements, int totalPages,
        List<String> availableAgeGroups) {
    public PlayerPageResponse(List<PlayerResponse> items, int page, int size, long totalElements, int totalPages) {
        this(items, page, size, totalElements, totalPages, List.of());
    }

    static PlayerPageResponse from(Page<Player> players) {
        return from(players, List.of());
    }

    static PlayerPageResponse from(Page<Player> players, List<String> availableAgeGroups) {
        return new PlayerPageResponse(
                players.map(PlayerResponse::from).getContent(), players.getNumber(),
                players.getSize(), players.getTotalElements(), players.getTotalPages(), availableAgeGroups);
    }
}
