package com.hanafc.match;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface MatchRepository extends JpaRepository<MatchRecord, Long> {
    interface GoalScorer {
        Long getMatchId(); Long getPlayerId(); String getName(); Integer getShirtNumber();
        com.hanafc.player.PlayerType getPlayerType(); long getGoals(); long getGoalsA(); long getGoalsB();
    }
    // 페이지에 표시할 경기들만 한 번에 집계한다. 계획 배치와 다른 경기의 득점은 포함하지 않는다.
    @Query("""
        select m.id as matchId, p.id as playerId, p.name as name, p.shirtNumber as shirtNumber,
               p.playerType as playerType, sum(a.goals) as goals,
               sum(case when a.team = com.hanafc.match.MatchTeam.A then a.goals else 0 end) as goalsA,
               sum(case when a.team = com.hanafc.match.MatchTeam.B then a.goals else 0 end) as goalsB
        from MatchRecord m join m.appearances a, Player p
        where m.id in :ids and p.id = a.playerId
        group by m.id, p.id, p.name, p.shirtNumber, p.playerType
        having sum(a.goals) > 0
        """)
    List<GoalScorer> goalScorers(Collection<Long> ids);
    interface AttendanceHistory {
        Long getPlayerId();
        long getAttended();
        long getRecorded();
    }
    @Query("""
        select p.playerId as playerId,
               sum(case when p.attendance in :attended then 1 else 0 end) as attended,
               count(p) as recorded
        from MatchRecord m join m.participants p
        where m.playedOn < :before and (:excludedId is null or m.id <> :excludedId)
          and p.playerId in :ids and p.attendance in :confirmed
        group by p.playerId
        """)
    List<AttendanceHistory> attendanceHistory(LocalDate before, Long excludedId, Collection<Long> ids,
            Collection<Attendance> attended, Collection<Attendance> confirmed);
}
