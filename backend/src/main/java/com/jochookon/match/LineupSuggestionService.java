package com.jochookon.match;

import com.jochookon.player.PlayerRepository;
import com.jochookon.team.TeamContext;
import java.util.*;
import java.util.concurrent.Semaphore;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class LineupSuggestionService {
    private final MatchRepository matches;
    private final PlayerRepository players;
    private final Semaphore calculation = new Semaphore(1);
    public LineupSuggestionService(MatchRepository matches, PlayerRepository players) {
        this.matches = matches; this.players = players;
    }
    public LineupSuggestion suggest(LineupSuggestionRequest request) {
        if (request.playedOn().getYear() < 1000 || request.playedOn().getYear() > 9999)
            throw new IllegalArgumentException("경기 날짜는 1000~9999년 사이여야 합니다.");
        if (new HashSet<>(request.playerIds()).size() != request.playerIds().size())
            throw new IllegalArgumentException("참석 명단에 같은 선수를 두 번 넣을 수 없습니다.");
        if (request.matchId() != null && !matches.existsByIdAndTeamId(request.matchId(), TeamContext.requireTeamId())) throw new MatchNotFoundException();
        if (!calculation.tryAcquire()) throw new IllegalArgumentException("다른 편성을 계산 중입니다. 잠시 후 다시 시도해 주세요.");
        try {
            var selected = players.findByTeamIdAndIdIn(TeamContext.requireTeamId(), request.playerIds());
            if (selected.size() != request.playerIds().size() || selected.stream().anyMatch(p -> !p.isActive()))
                throw new IllegalArgumentException("참석 명단에 없거나 활동 종료된 선수가 있습니다. 선수단을 다시 확인해 주세요.");
            var histories = matches.attendanceHistory(TeamContext.requireTeamId(), request.playedOn(), request.matchId(), request.playerIds(),
                    List.of(Attendance.PRESENT, Attendance.LATE), List.of(Attendance.PRESENT, Attendance.LATE, Attendance.ABSENT))
                    .stream().collect(Collectors.toMap(MatchRepository.AttendanceHistory::getPlayerId, Function.identity()));
            var candidates = selected.stream().map(p -> {
                var h = histories.get(p.getId());
                return new LineupOptimizer.Candidate(p.getId(), Arrays.asList(p.getFirstChoice(), p.getSecondChoice(), p.getThirdChoice()),
                        h == null ? 0 : h.getAttended(), h == null ? 0 : h.getRecorded());
            }).toList();
            return new LineupOptimizer().suggest(candidates, request.seed(), request.formation());
        } finally { calculation.release(); }
    }
}
