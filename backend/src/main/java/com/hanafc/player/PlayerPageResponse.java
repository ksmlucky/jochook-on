package com.hanafc.player;

import java.util.List;
import org.springframework.data.domain.Page;

public record PlayerPageResponse(
        List<PlayerResponse> items, int page, int size, long totalElements, int totalPages) {
    static PlayerPageResponse from(Page<Player> players) {
        return new PlayerPageResponse(
                players.map(PlayerResponse::from).getContent(), players.getNumber(),
                players.getSize(), players.getTotalElements(), players.getTotalPages());
    }
}
