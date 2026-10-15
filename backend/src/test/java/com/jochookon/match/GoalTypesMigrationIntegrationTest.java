package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.mysql.MySQLContainer;

@Tag("integration") @Testcontainers
class GoalTypesMigrationIntegrationTest {
    @Container static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Test void v25PreservesOldTotalsVersionsLineupsReceiptsAndChecksumsAndAddsZeros() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("24").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()));
        jdbc.update("INSERT INTO players(id,team_id,name,position,first_choice) VALUES (1,1,'세부득점 이전 가상 선수','FW','ST')");
        jdbc.update("INSERT INTO match_records(id,team_id,version,played_on,kickoff,venue,opponent,notes,match_kind,recording_stage,score_for,score_against) VALUES (1,1,5,'2026-10-15','11:00:00','','','보존 검증','EXTERNAL','COMPLETED',3,1)");
        jdbc.update("INSERT INTO match_participants VALUES (1,1,'ATTENDING','PRESENT')");
        jdbc.update("INSERT INTO match_quarters VALUES (1,1)");
        jdbc.update("INSERT INTO match_appearances(match_id,quarter_number,team,slot,entry_order,player_id,goals,assists) VALUES (1,1,'A','ST',0,1,3,1)");
        jdbc.update("INSERT INTO match_planned_lineups(match_id,quarter_number,team,slot,entry_order,player_id) VALUES (1,1,'A','ST',0,1)");
        jdbc.update("INSERT INTO match_save_requests(team_id,actor_account_id,request_key,request_method,request_fingerprint,match_id,result_version,completed_at) VALUES (1,123,'00000000-0000-0000-0000-000000000025','POST',?,1,5,'2026-10-15 01:00:00')", "b".repeat(64));
        var tables = List.of("players", "match_records", "match_participants", "match_quarters", "match_appearances", "match_planned_lineups", "match_save_requests");
        var before = new LinkedHashMap<String, List<Map<String, Object>>>();
        for (String table : tables) before.put(table, jdbc.queryForList("SELECT * FROM " + table));
        var checksums = jdbc.queryForList("SELECT version,checksum FROM flyway_schema_history WHERE success=1 ORDER BY installed_rank");
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("25").load().migrate();
        for (String table : tables) {
            var after = jdbc.queryForList("SELECT * FROM " + table);
            after.forEach(row -> { row.remove("free_kick_goals"); row.remove("penalty_goals"); });
            assertThat(after).as(table).containsExactlyInAnyOrderElementsOf(before.get(table));
        }
        assertThat(jdbc.queryForList("SELECT version,checksum FROM flyway_schema_history WHERE success=1 AND version<>'25' ORDER BY installed_rank")).isEqualTo(checksums);
        assertThat(jdbc.queryForObject("SELECT free_kick_goals + penalty_goals FROM match_appearances", Integer.class)).isZero();
        jdbc.update("UPDATE match_appearances SET free_kick_goals=1,penalty_goals=2");
        assertThatThrownBy(() -> jdbc.update("UPDATE match_appearances SET penalty_goals=3"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class).hasMessageContaining("chk_appearance_goal_types");
        assertThatThrownBy(() -> jdbc.update("UPDATE match_appearances SET free_kick_goals=-1"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class).hasMessageContaining("chk_appearance_free_kick_goals");
        assertThatThrownBy(() -> jdbc.update("UPDATE match_appearances SET penalty_goals=100"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
    }
}
