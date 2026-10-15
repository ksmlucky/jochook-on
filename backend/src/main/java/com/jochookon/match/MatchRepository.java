package com.jochookon.match;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface MatchRepository extends JpaRepository<MatchRecord, Long> {
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "tournament")
    Page<MatchRecord> findByTeamId(long teamId, Pageable pageable);
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "tournament")
    @Query(value = "select m from MatchRecord m where m.teamId = :teamId and m.tournament.id = :tournamentId",
            countQuery = "select count(m) from MatchRecord m where m.teamId = :teamId and m.tournament.id = :tournamentId")
    Page<MatchRecord> findByTeamIdAndTournamentId(long teamId, long tournamentId, Pageable pageable);
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "tournament")
    @Query(value = """
            select m from MatchRecord m where m.teamId = :teamId
              and (:tournamentId is null or m.tournament.id = :tournamentId)
              and ((:competitionScope = 'LEAGUE' and m.tournament is null)
                or (:competitionScope = 'TOURNAMENT' and m.kind = com.jochookon.match.MatchKind.EXTERNAL and m.tournament is not null))
            """, countQuery = """
            select count(m) from MatchRecord m where m.teamId = :teamId
              and (:tournamentId is null or m.tournament.id = :tournamentId)
              and ((:competitionScope = 'LEAGUE' and m.tournament is null)
                or (:competitionScope = 'TOURNAMENT' and m.kind = com.jochookon.match.MatchKind.EXTERNAL and m.tournament is not null))
            """)
    Page<MatchRecord> findCompetitionMatches(long teamId, Long tournamentId, String competitionScope, Pageable pageable);
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "tournament")
    @Query(value = """
            select m from MatchRecord m where m.teamId = :teamId and m.playedOn between :from and :through
              and (:tournamentId is null or m.tournament.id = :tournamentId)
              and (:competitionScope = 'ALL' or (:competitionScope = 'LEAGUE' and m.tournament is null)
                or (:competitionScope = 'TOURNAMENT' and m.kind = com.jochookon.match.MatchKind.EXTERNAL and m.tournament is not null))
            """, countQuery = """
            select count(m) from MatchRecord m where m.teamId = :teamId and m.playedOn between :from and :through
              and (:tournamentId is null or m.tournament.id = :tournamentId)
              and (:competitionScope = 'ALL' or (:competitionScope = 'LEAGUE' and m.tournament is null)
                or (:competitionScope = 'TOURNAMENT' and m.kind = com.jochookon.match.MatchKind.EXTERNAL and m.tournament is not null))
            """)
    Page<MatchRecord> findPeriodMatches(long teamId, Long tournamentId, String competitionScope,
                                       LocalDate from, LocalDate through, Pageable pageable);
    @Query("select distinct year(m.playedOn) from MatchRecord m where m.teamId = :teamId order by year(m.playedOn) desc")
    List<Integer> years(long teamId);
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "tournament")
    Optional<MatchRecord> findByIdAndTeamId(long id, long teamId);
    boolean existsByIdAndTeamId(long id, long teamId);
    interface GoalScorer {
        Long getMatchId(); Long getPlayerId(); String getName(); Integer getShirtNumber();
        com.jochookon.player.PlayerType getPlayerType(); long getGoals(); long getGoalsA(); long getGoalsB();
        long getFreeKickGoals(); long getPenaltyGoals();
    }
    // 페이지에 표시할 경기들만 한 번에 집계한다. 계획 배치와 다른 경기의 득점은 포함하지 않는다.
    @Query("""
        select m.id as matchId, p.id as playerId, p.name as name, p.shirtNumber as shirtNumber,
               p.playerType as playerType, sum(a.goals) as goals,
               sum(case when a.team = com.jochookon.match.MatchTeam.A then a.goals else 0 end) as goalsA,
               sum(case when a.team = com.jochookon.match.MatchTeam.B then a.goals else 0 end) as goalsB,
               sum(a.freeKickGoals) as freeKickGoals, sum(a.penaltyGoals) as penaltyGoals
        from MatchRecord m join m.appearances a, Player p
        where m.teamId = :teamId and p.teamId = :teamId and m.id in :ids and p.id = a.playerId
        group by m.id, p.id, p.name, p.shirtNumber, p.playerType
        having sum(a.goals) > 0
        """)
    List<GoalScorer> goalScorers(long teamId, Collection<Long> ids);
    interface AttendanceHistory {
        Long getPlayerId();
        long getAttended();
        long getRecorded();
    }
    @Query("""
        select p.playerId as playerId,
               sum(case when p.attendance in :attended then 1 else 0 end) as attended,
               count(p.playerId) as recorded
        from MatchRecord m join m.participants p
        where m.teamId = :teamId and m.playedOn < :before and (:excludedId is null or m.id <> :excludedId)
          and p.playerId in :ids and p.attendance in :confirmed
        group by p.playerId
        """)
    List<AttendanceHistory> attendanceHistory(long teamId, LocalDate before, Long excludedId, Collection<Long> ids,
            Collection<Attendance> attended, Collection<Attendance> confirmed);
}
