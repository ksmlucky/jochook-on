package com.jochookon.match;

import com.jochookon.player.Player;
import com.jochookon.player.PlayerRepository;
import com.jochookon.team.TeamContext;
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
    private final MatchHistoryService history;
    public MatchService(MatchRepository matches, PlayerRepository players, MatchHistoryService history) {
        this.matches = matches; this.players = players; this.history = history;
    }
    public MatchResponse.Page list(int page, int size) {
        long teamId = TeamContext.requireTeamId();
        var result = matches.findByTeamId(teamId, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "playedOn", "id")));
        var ids = result.getContent().stream().map(MatchRecord::getId).toList();
        Map<Long, List<MatchResponse.Scorer>> scorers = new HashMap<>();
        if (!ids.isEmpty()) for (var scorer : matches.goalScorers(teamId, ids)) {
            scorers.computeIfAbsent(scorer.getMatchId(), key -> new ArrayList<>()).add(new MatchResponse.Scorer(
                    scorer.getPlayerId(), scorer.getName(), scorer.getShirtNumber(), scorer.getPlayerType(), scorer.getGoals(), scorer.getGoalsA(), scorer.getGoalsB()));
        }
        return new MatchResponse.Page(result.map(m -> MatchResponse.Summary.from(m, scorers.getOrDefault(m.getId(), List.of()))).getContent(), page, result.getTotalPages(), result.getTotalElements());
    }
    public MatchResponse get(long id) { return response(matches.findByIdAndTeamId(id, TeamContext.requireTeamId()).orElseThrow(MatchNotFoundException::new)); }
    @Transactional
    public MatchResponse create(MatchRequest request) {
        if (request.version() != null) throw new IllegalArgumentException("새 경기에는 수정 버전을 지정하지 않습니다.");
        validatePlayers(request);
        var saved = response(matches.saveAndFlush(MatchRecord.create(request).assignToTeam(TeamContext.requireTeamId())));
        history.append(MatchHistory.Action.CREATED, null, saved);
        return saved;
    }
    @Transactional
    public MatchResponse update(long id, MatchRequest request) {
        var match = matches.findByIdAndTeamId(id, TeamContext.requireTeamId()).orElseThrow(MatchNotFoundException::new);
        if (request.version() == null) throw new IllegalArgumentException("수정 버전이 필요합니다.");
        if (!Objects.equals(match.getVersion(), request.version())) throw new ObjectOptimisticLockingFailureException(MatchRecord.class, id);
        validatePlayers(request);
        var before = response(match);
        match.replace(request);
        var after = response(matches.saveAndFlush(match));
        history.append(MatchHistory.Action.UPDATED, before, after);
        return after;
    }
    @Transactional
    public void delete(long id, long version) {
        if (version < 0) throw new IllegalArgumentException("삭제할 경기의 수정 버전을 확인해 주세요.");
        var match = matches.findByIdAndTeamId(id, TeamContext.requireTeamId()).orElseThrow(MatchNotFoundException::new);
        if (!Objects.equals(match.getVersion(), version)) throw new ObjectOptimisticLockingFailureException(MatchRecord.class, id);
        var before = response(match);
        // 엔티티 삭제로 네 값 객체 컬렉션과 @Version 검사를 함께 처리한다.
        // 조회 직후 다른 요청이 수정한 경우에도 flush 실패로 하위 기록 삭제까지 롤백된다.
        matches.delete(match);
        matches.flush();
        history.append(MatchHistory.Action.DELETED, before, null);
    }
    private void validatePlayers(MatchRequest request) {
        MatchRecord.validateRules(request);
        Set<Long> ids = request.participants().stream().map(MatchRequest.Participant::playerId).collect(Collectors.toSet());
        if (players.findByTeamIdAndIdIn(TeamContext.requireTeamId(), ids).size() != ids.size()) throw new IllegalArgumentException("현재 팀의 선수 목록과 일치하지 않습니다. 선수 목록을 다시 확인해 주세요.");
    }
    private MatchResponse response(MatchRecord match) {
        Map<Long, Player> names = players.findByTeamIdAndIdIn(TeamContext.requireTeamId(), match.getParticipants().stream().map(MatchParticipant::getPlayerId).toList())
                .stream().collect(Collectors.toMap(Player::getId, Function.identity()));
        return MatchResponse.from(match, names);
    }
}
