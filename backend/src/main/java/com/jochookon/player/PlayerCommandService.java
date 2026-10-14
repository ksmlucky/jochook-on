package com.jochookon.player;

import java.util.Objects;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PlayerCommandService {
    private final PlayerRepository players;

    public PlayerCommandService(PlayerRepository players) { this.players = players; }

    public PlayerResponse create(CreatePlayerRequest request) {
        if (request.shirtNumber() != null && players.existsByActiveTrueAndShirtNumber(request.shirtNumber())) throw new DuplicateShirtNumberException();
        Player player = Player.register(request.name(), request.shirtNumber(), request.position(), request.joinedOn());
        player.updatePreferences(request.firstChoice(), request.secondChoice(), request.thirdChoice());
        player.updateProfile(request.birthYear(), request.clubRole());
        return PlayerResponse.from(players.saveAndFlush(player));
    }

    public PlayerResponse createGuest(GuestPlayerRequest request) {
        if (request.shirtNumber() != null && players.existsByActiveTrueAndShirtNumber(request.shirtNumber())) throw new DuplicateShirtNumberException();
        return PlayerResponse.from(players.saveAndFlush(Player.registerGuest(request)));
    }

    public PlayerResponse update(long id, UpdatePlayerRequest request) {
        Player player = players.findById(id).filter(Player::isActive).orElseThrow(PlayerNotFoundException::new);
        // 화면을 연 뒤 이미 변경된 기록인지 먼저 검사하고, 동시 저장은 JPA @Version이 감지한다.
        if (!Objects.equals(player.getVersion(), request.version())) {
            throw new ObjectOptimisticLockingFailureException(Player.class, id);
        }
        if (request.shirtNumber() != null && players.existsByActiveTrueAndShirtNumberAndIdNot(request.shirtNumber(), id)) throw new DuplicateShirtNumberException();
        player.updateDetails(request.name(), request.shirtNumber(), request.position(), request.joinedOn());
        player.updatePreferences(request.firstChoice(), request.secondChoice(), request.thirdChoice());
        player.updateProfile(request.birthYear(), request.clubRole());
        players.flush();
        return PlayerResponse.from(player);
    }
}
