package com.jochookon.player;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PlayerQueryService {
    private final PlayerRepository playerRepository;

    public PlayerQueryService(PlayerRepository playerRepository) {
        this.playerRepository = playerRepository;
    }

    public PlayerPageResponse findActivePlayers(int page, int size, String sort, String direction) {
        return findActivePlayers(page, size, sort, direction, PlayerType.MEMBER);
    }
    public PlayerPageResponse findActivePlayers(int page, int size, String sort, String direction, PlayerType type) {
        String property = switch (sort) {
            case "id", "shirtNumber", "name" -> sort;
            case "age" -> "birthYear";
            case "preferredPosition" -> "firstChoice";
            default -> throw new IllegalArgumentException("지원하지 않는 선수 정렬입니다.");
        };
        if (!direction.equals("asc") && !direction.equals("desc")) throw new IllegalArgumentException("정렬 방향을 확인해 주세요.");
        boolean ascending = direction.equals("asc") != sort.equals("age");
        Specification<Player> activeInOrder = (root, query, cb) -> {
            // 전체 명단을 먼저 정렬한 뒤 LIMIT/OFFSET을 적용한다. 미입력 값은 항상 뒤로 보낸다.
            if (query != null && query.getResultType() != Long.class) {
                var value = root.get(property);
                var unknown = cb.<Integer>selectCase().when(cb.isNull(value), 1).otherwise(0);
                if (sort.equals("preferredPosition")) {
                    var firstChoice = root.<PreferredPosition>get("firstChoice");
                    var group = cb.<Integer>selectCase()
                            .when(cb.equal(firstChoice, PreferredPosition.GK), 0)
                            .when(firstChoice.in(PreferredPosition.LB, PreferredPosition.CB, PreferredPosition.RB), 1)
                            .when(firstChoice.in(PreferredPosition.CDM, PreferredPosition.CM), 2)
                            .when(firstChoice.in(PreferredPosition.LW, PreferredPosition.ST, PreferredPosition.RW), 3)
                            .otherwise(4);
                    var shirt = root.<Integer>get("shirtNumber");
                    var unknownShirt = cb.<Integer>selectCase().when(cb.isNull(shirt), 1).otherwise(0);
                    // 방향은 포지션 그룹에만 적용한다. 같은 그룹에서는 등번호 순서를 유지한다.
                    query.orderBy(cb.asc(unknown), ascending ? cb.asc(group) : cb.desc(group),
                            cb.asc(unknownShirt), cb.asc(shirt), cb.asc(root.get("id")));
                } else {
                    query.orderBy(cb.asc(unknown), ascending ? cb.asc(value) : cb.desc(value), cb.asc(root.get("id")));
                }
            }
            return cb.and(cb.isTrue(root.get("active")), cb.equal(root.get("playerType"), type));
        };
        return PlayerPageResponse.from(playerRepository.findAll(activeInOrder, PageRequest.of(page, size)));
    }

    public PlayerResponse findActivePlayer(long id) {
        return playerRepository.findById(id).filter(Player::isActive)
                .map(PlayerResponse::from).orElseThrow(PlayerNotFoundException::new);
    }
}
