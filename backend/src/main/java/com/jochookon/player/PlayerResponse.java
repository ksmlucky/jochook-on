package com.jochookon.player;

import java.time.LocalDate;

public record PlayerResponse(Long id, String name, Integer shirtNumber, Position position,
                             LocalDate joinedOn, Long version,
                             PreferredPosition firstChoice, PreferredPosition secondChoice, PreferredPosition thirdChoice,
                             Integer birthYear, String clubRole, PlayerType playerType) {
    static PlayerResponse from(Player player) {
        return new PlayerResponse(player.getId(), player.getName(), player.getShirtNumber(), player.getPosition(),
                player.getJoinedOn(), player.getVersion(), player.getFirstChoice(), player.getSecondChoice(), player.getThirdChoice(), player.getBirthYear(), player.getClubRole(), player.getPlayerType());
    }
}
