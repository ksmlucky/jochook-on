package com.hanafc.match;

import com.hanafc.player.Player;
import com.hanafc.player.PlayerRepository;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class MatchService {
    private final MatchRepository matches;
    private final PlayerRepository players;
    public MatchService(MatchRepository matches, PlayerRepository players) { this.matches = matches; this.players = players; }
    public MatchResponse.Page list(int page, int size) {
        var result = matches.findAll(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "playedOn", "id")));
        var ids = result.getContent().stream().map(MatchRecord::getId).toList();
        Map<Long, List<MatchResponse.Scorer>> scorers = new HashMap<>();
        if (!ids.isEmpty()) for (var scorer : matches.goalScorers(ids)) {
            scorers.computeIfAbsent(scorer.getMatchId(), key -> new ArrayList<>()).add(new MatchResponse.Scorer(
                    scorer.getPlayerId(), scorer.getName(), scorer.getShirtNumber(), scorer.getPlayerType(), scorer.getGoals(), scorer.getGoalsA(), scorer.getGoalsB()));
        }
        return new MatchResponse.Page(result.map(m -> MatchResponse.Summary.from(m, scorers.getOrDefault(m.getId(), List.of()))).getContent(), page, result.getTotalPages(), result.getTotalElements());
    }
    public MatchResponse get(long id) { return response(matches.findById(id).orElseThrow(MatchNotFoundException::new)); }
    @Transactional
    public MatchResponse create(MatchRequest request) {
        if (request.version() != null) throw new IllegalArgumentException("새 경기에는 수정 버전을 지정하지 않습니다.");
        validatePlayers(request);
        return response(matches.saveAndFlush(MatchRecord.create(request)));
    }
    @Transactional
    public MatchResponse update(long id, MatchRequest request) {
        var match = matches.findById(id).orElseThrow(MatchNotFoundException::new);
        if (request.version() == null) throw new IllegalArgumentException("수정 버전이 필요합니다.");
        if (!Objects.equals(match.getVersion(), request.version())) throw new ObjectOptimisticLockingFailureException(MatchRecord.class, id);
        validatePlayers(request);
        match.replace(request);
        return response(matches.saveAndFlush(match));
    }
    private void validatePlayers(MatchRequest request) {
        MatchRecord.validateRules(request);
        Set<Long> ids = request.participants().stream().map(MatchRequest.Participant::playerId).collect(Collectors.toSet());
        if (players.findAllById(ids).size() != ids.size()) throw new IllegalArgumentException("존재하지 않는 선수가 있습니다. 선수 목록을 다시 확인해 주세요.");
    }
    private MatchResponse response(MatchRecord match) {
        Map<Long, Player> names = players.findAllById(match.getParticipants().stream().map(MatchParticipant::getPlayerId).toList())
                .stream().collect(Collectors.toMap(Player::getId, Function.identity()));
        return MatchResponse.from(match, names);
    }
}
