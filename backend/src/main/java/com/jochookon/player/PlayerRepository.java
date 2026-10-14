package com.jochookon.player;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PlayerRepository extends JpaRepository<Player, Long>, JpaSpecificationExecutor<Player> {
    @Query("select distinct p.birthYear from Player p where p.teamId = :teamId and p.active = true and p.playerType = :type")
    List<Integer> findDistinctActiveBirthYears(@Param("teamId") long teamId, @Param("type") PlayerType type);

    Optional<Player> findByIdAndTeamId(long id, long teamId);
    List<Player> findByTeamIdAndIdIn(long teamId, Collection<Long> ids);
    List<Player> findByTeamIdAndNameIn(long teamId, Collection<String> names);
    boolean existsByTeamIdAndActiveTrueAndShirtNumber(long teamId, Integer shirtNumber);
    boolean existsByTeamIdAndActiveTrueAndShirtNumberAndIdNot(long teamId, Integer shirtNumber, Long id);
    List<Player> findByTeamIdAndActiveTrueAndShirtNumberIn(long teamId, Collection<Integer> shirtNumbers);
}
