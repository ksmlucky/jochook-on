package com.jochookon.player;

import com.jochookon.team.TeamContext;

import jakarta.persistence.criteria.Predicate;
import java.time.Year;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PlayerQueryService {
    private static final List<String> AGE_GROUPS = List.of("UNDER_20", "20", "30", "40", "50", "60", "70", "80", "90", "100_PLUS", "UNKNOWN");
    private final PlayerRepository playerRepository;

    public PlayerQueryService(PlayerRepository playerRepository) {
        this.playerRepository = playerRepository;
    }

    public PlayerPageResponse findActivePlayers(int page, int size, String sort, String direction) {
        return findActivePlayers(page, size, sort, direction, PlayerType.MEMBER);
    }
    public PlayerPageResponse findActivePlayers(int page, int size, String sort, String direction, PlayerType type) {
        return findActivePlayers(page, size, sort, direction, type, "", "", "", "");
    }

    public PlayerPageResponse findActivePlayers(int page, int size, String sort, String direction,
                                               String ageGroup, String clubRole, String firstChoice) {
        return findActivePlayers(page, size, sort, direction, ageGroup, clubRole, firstChoice, "");
    }

    public PlayerPageResponse findActivePlayers(int page, int size, String sort, String direction,
                                               String ageGroup, String clubRole, String firstChoice, String positionGroup) {
        return findActivePlayers(page, size, sort, direction, PlayerType.MEMBER, ageGroup, clubRole, firstChoice, positionGroup);
    }

    private PlayerPageResponse findActivePlayers(int page, int size, String sort, String direction,
                                                 PlayerType type, String ageGroup, String clubRole, String firstChoice, String positionGroup) {
        long teamId = TeamContext.requireTeamId();
        if (!ageGroup.matches("|UNDER_20|20|30|40|50|60|70|80|90|100_PLUS|UNKNOWN")) {
            throw new IllegalArgumentException("연령대 필터를 확인해 주세요.");
        }
        if (!clubRole.isEmpty() && !ClubRoles.VALUES.contains(clubRole)) {
            throw new IllegalArgumentException("직책 필터를 확인해 주세요.");
        }
        if (!firstChoice.matches("|GK|LB|CB|RB|LWB|RWB|CDM|CM|LM|RM|CAM|LW|ST|RW|UNKNOWN")) {
            throw new IllegalArgumentException("1지망 포지션 필터를 확인해 주세요.");
        }
        if (!positionGroup.matches("|FW|MF|DF|GK")) {
            throw new IllegalArgumentException("포지션 그룹 필터를 확인해 주세요.");
        }
        // 대회 연령은 생일과 무관하게 한국의 현재 연도 - 생년으로 계산한다.
        int currentYear = Year.now(ZoneId.of("Asia/Seoul")).getValue();
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
                    var preferred = root.<PreferredPosition>get("firstChoice");
                    var group = cb.<Integer>selectCase()
                            .when(cb.equal(preferred, PreferredPosition.GK), 0)
                            .when(preferred.in(PreferredPosition.LB, PreferredPosition.CB, PreferredPosition.RB, PreferredPosition.LWB, PreferredPosition.RWB), 1)
                            .when(preferred.in(PreferredPosition.CDM, PreferredPosition.CM, PreferredPosition.LM, PreferredPosition.RM, PreferredPosition.CAM), 2)
                            .when(preferred.in(PreferredPosition.LW, PreferredPosition.ST, PreferredPosition.RW), 3)
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
            List<Predicate> filters = new ArrayList<>();
            filters.add(cb.equal(root.get("teamId"), teamId));
            filters.add(cb.isTrue(root.get("active")));
            filters.add(cb.equal(root.get("playerType"), type));
            var birthYear = root.<Integer>get("birthYear");
            switch (ageGroup) {
                case "" -> { }
                case "UNKNOWN" -> filters.add(cb.isNull(birthYear));
                case "UNDER_20" -> filters.add(cb.between(birthYear, currentYear - 19, currentYear));
                case "100_PLUS" -> filters.add(cb.lessThanOrEqualTo(birthYear, currentYear - 100));
                default -> {
                    int minimumAge = Integer.parseInt(ageGroup);
                    filters.add(cb.between(birthYear, currentYear - minimumAge - 9, currentYear - minimumAge));
                }
            }
            if (!clubRole.isEmpty()) filters.add(cb.equal(root.get("clubRole"), clubRole));
            if (firstChoice.equals("UNKNOWN")) filters.add(cb.isNull(root.get("firstChoice")));
            else if (!firstChoice.isEmpty()) filters.add(cb.equal(root.get("firstChoice"), PreferredPosition.valueOf(firstChoice)));
            if (!positionGroup.isEmpty()) {
                List<PreferredPosition> positions = switch (positionGroup) {
                    case "FW" -> List.of(PreferredPosition.LW, PreferredPosition.ST, PreferredPosition.RW);
                    case "MF" -> List.of(PreferredPosition.CM, PreferredPosition.CDM, PreferredPosition.LM, PreferredPosition.RM, PreferredPosition.CAM);
                    case "DF" -> List.of(PreferredPosition.LB, PreferredPosition.CB, PreferredPosition.RB, PreferredPosition.LWB, PreferredPosition.RWB);
                    case "GK" -> List.of(PreferredPosition.GK);
                    default -> throw new IllegalArgumentException("포지션 그룹 필터를 확인해 주세요.");
                };
                // 과거 position 컬럼이나 2·3지망 대신 1지망만으로 그룹을 결정한다.
                filters.add(root.<PreferredPosition>get("firstChoice").in(positions));
            }
            return cb.and(filters.toArray(Predicate[]::new));
        };
        var players = playerRepository.findAll(activeInOrder, PageRequest.of(page, size));
        var availableAgeGroups = type == PlayerType.MEMBER ? availableAgeGroups(teamId, currentYear) : List.<String>of();
        return PlayerPageResponse.from(players, availableAgeGroups);
    }

    private List<String> availableAgeGroups(long teamId, int currentYear) {
        // 필터와 페이지에 상관없이 현재 팀의 활동 회원에 실제 존재하는 연령대만 제공한다.
        Set<String> present = new HashSet<>();
        for (Integer birthYear : playerRepository.findDistinctActiveBirthYears(teamId, PlayerType.MEMBER)) {
            if (birthYear == null) present.add("UNKNOWN");
            else {
                int age = currentYear - birthYear;
                if (age >= 0) present.add(age < 20 ? "UNDER_20" : age >= 100 ? "100_PLUS" : Integer.toString(age / 10 * 10));
            }
        }
        return AGE_GROUPS.stream().filter(present::contains).toList();
    }

    public PlayerResponse findActivePlayer(long id) {
        return playerRepository.findByIdAndTeamId(id, TeamContext.requireTeamId()).filter(Player::isActive)
                .map(PlayerResponse::from).orElseThrow(PlayerNotFoundException::new);
    }
}
