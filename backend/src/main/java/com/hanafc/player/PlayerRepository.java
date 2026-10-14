package com.hanafc.player;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.Collection;
import java.util.List;

public interface PlayerRepository extends JpaRepository<Player, Long>, JpaSpecificationExecutor<Player> {
    Page<Player> findByActiveTrue(Pageable pageable);
    List<Player> findByNameIn(Collection<String> names);
    boolean existsByActiveTrueAndShirtNumber(Integer shirtNumber);
    boolean existsByActiveTrueAndShirtNumberAndIdNot(Integer shirtNumber, Long id);
    List<Player> findByActiveTrueAndShirtNumberIn(Collection<Integer> shirtNumbers);
}
