package com.jochookon.tournament;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TournamentRepository extends JpaRepository<Tournament, Long> {
    Page<Tournament> findByTeamId(long teamId, Pageable pageable);
    @Query(value = "select t from Tournament t where t.teamId = :teamId and t.startDate <= :through and t.endDate >= :from",
            countQuery = "select count(t) from Tournament t where t.teamId = :teamId and t.startDate <= :through and t.endDate >= :from")
    Page<Tournament> findOverlappingPeriod(long teamId, java.time.LocalDate from, java.time.LocalDate through, Pageable pageable);
    interface YearRange { Integer getFirstYear(); Integer getLastYear(); }
    @Query("select distinct year(t.startDate) as firstYear, year(t.endDate) as lastYear from Tournament t where t.teamId = :teamId")
    List<YearRange> yearRanges(long teamId);
    Optional<Tournament> findByIdAndTeamId(long id, long teamId);
    interface MatchCount { Long getTournamentId(); long getCount(); }
    @Query("""
            select m.tournament.id as tournamentId, count(m) as count from MatchRecord m
            where m.teamId = :teamId and m.tournament.id in :ids group by m.tournament.id
            """)
    List<MatchCount> matchCounts(long teamId, Collection<Long> ids);
}
