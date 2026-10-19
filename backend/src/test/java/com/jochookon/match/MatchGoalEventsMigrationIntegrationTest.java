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
class MatchGoalEventsMigrationIntegrationTest {
    @Container static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @BeforeEach void resetOnlyTheTestcontainerSchema() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).cleanDisabled(false).load().clean();
    }
    @Test void v31KeepsLegacyTotalsReceiptsVersionsAndChecksumsWithoutInventingAssists() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("30").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()));
        jdbc.update("INSERT INTO players(id,team_id,name,position,first_choice) VALUES (1,1,'연결 이전 가상 선수','FW','ST'),(2,1,'가상 도움 선수','MF','CM')");
        jdbc.update("INSERT INTO match_records(id,team_id,version,played_on,kickoff,venue,opponent,notes,match_kind,recording_stage,score_for,score_against) VALUES (1,1,5,'2026-10-15','11:00:00','','','보존 검증','EXTERNAL','COMPLETED',3,1)");
        jdbc.update("INSERT INTO match_participants(match_id,player_id,vote,attendance) VALUES (1,1,'ATTENDING','PRESENT')");
        jdbc.update("INSERT INTO match_quarters(match_id,quarter_number) VALUES (1,1)");
        jdbc.update("INSERT INTO match_appearances(match_id,quarter_number,team,slot,entry_order,player_id,goals,assists,free_kick_goals,penalty_goals) VALUES (1,1,'A','ST',0,1,3,1,1,1)");
        jdbc.update("INSERT INTO match_save_requests(team_id,actor_account_id,request_key,request_method,request_fingerprint,match_id,result_version,completed_at) VALUES (1,123,'00000000-0000-0000-0000-000000000031','POST',?,1,5,'2026-10-15 01:00:00')", "d".repeat(64));
        var tables = List.of("players", "match_records", "match_participants", "match_quarters", "match_appearances", "match_save_requests");
        var before = new LinkedHashMap<String, List<Map<String, Object>>>();
        for (String table : tables) before.put(table, jdbc.queryForList("SELECT * FROM " + table));
        var checksums = jdbc.queryForList("SELECT version,checksum FROM flyway_schema_history WHERE success=1 ORDER BY installed_rank");
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("31").load().migrate();
        for (String table : tables) {
            var after = jdbc.queryForList("SELECT * FROM " + table);
            after.forEach(row -> row.remove("goal_events_linked"));
            assertThat(after).as(table).containsExactlyInAnyOrderElementsOf(before.get(table));
        }
        assertThat(jdbc.queryForList("SELECT version,checksum FROM flyway_schema_history WHERE success=1 AND version<>'31' ORDER BY installed_rank")).isEqualTo(checksums);
        assertThat(jdbc.queryForObject("SELECT goal_events_linked FROM match_quarters", Boolean.class)).isFalse();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_goal_events", Integer.class)).isZero();
        jdbc.update("INSERT INTO match_goal_events(match_id,event_order,quarter_number,scorer_id,assist_id,goal_type,team) VALUES (1,0,1,1,2,'NORMAL','A')");
        assertThatThrownBy(() -> jdbc.update("UPDATE match_goal_events SET assist_id=1")).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE match_goal_events SET goal_type='PENALTY'")).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE match_goal_events SET quarter_number=5")).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE match_goal_events SET scorer_id=9999")).isInstanceOf(org.springframework.dao.DataAccessException.class);
    }
}
