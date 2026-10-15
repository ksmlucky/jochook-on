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
    private final com.jochookon.tournament.TournamentService tournaments;
    public MatchService(MatchRepository matches, PlayerRepository players, MatchHistoryService history,
                        com.jochookon.tournament.TournamentService tournaments) {
        this.matches = matches; this.players = players; this.history = history; this.tournaments = tournaments;
    }
    public MatchResponse.Page list(int page, int size) {
        return list(page, size, null);
    }
    public MatchResponse.Page list(int page, int size, Long tournamentId) {
        return list(page, size, tournamentId, CompetitionScope.ALL);
    }
    public MatchResponse.Page list(int page, int size, Long tournamentId, CompetitionScope competitionScope) {
        return list(page, size, tournamentId, competitionScope, null, null);
    }
    public MatchResponse.Page list(int page, int size, Long tournamentId, CompetitionScope competitionScope, Integer year, Integer month) {
        return list(page, size, tournamentId, competitionScope, year, month, null, null);
    }
    public MatchResponse.Page list(int page, int size, Long tournamentId, CompetitionScope competitionScope, Integer year, Integer month,
                                   String startMonth, String endMonth) {
        long teamId = TeamContext.requireTeamId();
        Objects.requireNonNull(competitionScope).validate(tournamentId);
        var period = com.jochookon.common.CalendarPeriod.of(year, month, startMonth, endMonth);
        var paging = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "playedOn", "id"));
        if (tournamentId != null) tournaments.require(tournamentId);
        var result = period.from() != null ? matches.findPeriodMatches(teamId, tournamentId, competitionScope.name(), period.from(), period.through(), paging)
                : competitionScope != CompetitionScope.ALL
                ? matches.findCompetitionMatches(teamId, tournamentId, competitionScope.name(), paging)
                : tournamentId == null ? matches.findByTeamId(teamId, paging)
                : matches.findByTeamIdAndTournamentId(teamId, tournamentId, paging);
        var ids = result.getContent().stream().map(MatchRecord::getId).toList();
        Map<Long, List<MatchResponse.Scorer>> scorers = new HashMap<>();
        if (!ids.isEmpty()) for (var scorer : matches.goalScorers(teamId, ids)) {
            scorers.computeIfAbsent(scorer.getMatchId(), key -> new ArrayList<>()).add(new MatchResponse.Scorer(
                    scorer.getPlayerId(), scorer.getName(), scorer.getShirtNumber(), scorer.getPlayerType(), scorer.getGoals(), scorer.getGoalsA(), scorer.getGoalsB(), scorer.getFreeKickGoals(), scorer.getPenaltyGoals()));
        }
        return new MatchResponse.Page(result.map(m -> MatchResponse.Summary.from(m, scorers.getOrDefault(m.getId(), List.of()))).getContent(), page, result.getTotalPages(), result.getTotalElements(), competitionScope);
    }
    public List<Integer> years() { return matches.years(TeamContext.requireTeamId()); }
    public MatchResponse get(long id) { return response(matches.findByIdAndTeamId(id, TeamContext.requireTeamId()).orElseThrow(MatchNotFoundException::new)); }
    @Transactional
    public MatchResponse create(MatchRequest request) {
        if (request.version() != null) throw new IllegalArgumentException("새 경기에는 수정 버전을 지정하지 않습니다.");
        validatePlayers(request);
        var match = MatchRecord.create(request).assignToTeam(TeamContext.requireTeamId());
        applyTournament(match, request);
        var saved = response(matches.saveAndFlush(match));
        history.append(MatchHistory.Action.CREATED, null, saved);
        return saved;
    }
    @Transactional
    public MatchResponse update(long id, MatchRequest request) {
        var match = matches.findByIdAndTeamId(id, TeamContext.requireTeamId()).orElseThrow(MatchNotFoundException::new);
        if (request.version() == null) throw new IllegalArgumentException("수정 버전이 필요합니다.");
        if (!Objects.equals(match.getVersion(), request.version())) throw new ObjectOptimisticLockingFailureException(MatchRecord.class, id);
        request = request.resolveMatchFormat(match.getMatchFormat()).resolveFormations(match.getFormationA(), match.getFormationB()).resolvePlannedTeams(match.getParticipants());
        validatePlayers(request);
        var before = response(match);
        match.replace(request);
        applyTournament(match, request);
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
    private void applyTournament(MatchRecord match, MatchRequest request) {
        if (request.changesTournament()) match.setTournament(request.tournamentId() == null ? null
                : tournaments.require(request.tournamentId()), request.tournamentStage());
    }
    private MatchResponse response(MatchRecord match) {
        Map<Long, Player> names = players.findByTeamIdAndIdIn(TeamContext.requireTeamId(), match.getParticipants().stream().map(MatchParticipant::getPlayerId).toList())
                .stream().collect(Collectors.toMap(Player::getId, Function.identity()));
        return MatchResponse.from(match, names);
    }
}
