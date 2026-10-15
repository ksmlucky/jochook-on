package com.jochookon.tournament;

import com.jochookon.team.TeamContext;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class TournamentService {
    private final TournamentRepository tournaments;
    public TournamentService(TournamentRepository tournaments) { this.tournaments = tournaments; }
    public TournamentResponse.Page list(int page, int size) {
        return list(page, size, null, null);
    }
    public TournamentResponse.Page list(int page, int size, Integer year, Integer month) {
        return list(page, size, year, month, null, null);
    }
    public TournamentResponse.Page list(int page, int size, Integer year, Integer month, String startMonth, String endMonth) {
        long team = TeamContext.requireTeamId();
        if (page < 0 || size < 1 || size > 100) throw new IllegalArgumentException("페이지와 조회 개수를 확인해 주세요.");
        var period = com.jochookon.common.CalendarPeriod.of(year, month, startMonth, endMonth);
        var paging = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "startDate", "id"));
        var result = period.from() == null ? tournaments.findByTeamId(team, paging)
                : tournaments.findOverlappingPeriod(team, period.from(), period.through(), paging);
        var ids = result.getContent().stream().map(Tournament::getId).toList();
        var counts = ids.isEmpty() ? java.util.Map.<Long, Long>of() : tournaments.matchCounts(team, ids).stream()
                .collect(Collectors.toMap(TournamentRepository.MatchCount::getTournamentId, TournamentRepository.MatchCount::getCount));
        return new TournamentResponse.Page(result.map(t -> TournamentResponse.from(t, counts.getOrDefault(t.getId(), 0L)))
                .getContent(), page, result.getTotalPages(), result.getTotalElements());
    }
    public List<Integer> years() {
        return tournaments.yearRanges(TeamContext.requireTeamId()).stream()
                .flatMapToInt(range -> java.util.stream.IntStream.rangeClosed(range.getFirstYear(), range.getLastYear()))
                .distinct().boxed().sorted(java.util.Comparator.reverseOrder()).toList();
    }
    public Tournament require(long id) {
        return tournaments.findByIdAndTeamId(id, TeamContext.requireTeamId()).orElseThrow(TournamentNotFoundException::new);
    }
    public TournamentResponse get(long id) { return response(require(id)); }
    @Transactional
    public TournamentResponse create(TournamentRequest request) {
        if (request.version() != null) throw new IllegalArgumentException("새 대회에는 수정 버전을 지정하지 않습니다.");
        return response(tournaments.saveAndFlush(Tournament.create(TeamContext.requireTeamId(), request)));
    }
    @Transactional
    public TournamentResponse update(long id, TournamentRequest request) {
        var tournament = require(id);
        if (request.version() == null) throw new IllegalArgumentException("수정 버전이 필요합니다.");
        if (!Objects.equals(tournament.getVersion(), request.version()))
            throw new ObjectOptimisticLockingFailureException(Tournament.class, id);
        tournament.replace(request);
        return response(tournaments.saveAndFlush(tournament));
    }
    private TournamentResponse response(Tournament tournament) {
        long count = tournaments.matchCounts(TeamContext.requireTeamId(), List.of(tournament.getId()))
                .stream().mapToLong(TournamentRepository.MatchCount::getCount).sum();
        return TournamentResponse.from(tournament, count);
    }
}
