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
class MatchScoringOrderMigrationIntegrationTest {
    @Container static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Test void v33DoesNotInventChronologyOrChangeScoresReceiptsAndChecksums() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("32").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()));
        jdbc.update("INSERT INTO players(id,team_id,name,position,first_choice) VALUES (1,1,'순서 검증 선수','FW','ST')");
        jdbc.update("INSERT INTO match_records(id,team_id,version,played_on,kickoff,venue,opponent,notes,match_kind,score_for,score_against) VALUES (1,1,5,'2026-10-15','11:00:00','','','','EXTERNAL',1,2)");
        jdbc.update("INSERT INTO match_quarters(match_id,quarter_number,goal_events_linked,goals_against) VALUES (1,1,TRUE,2),(1,2,FALSE,NULL)");
        jdbc.update("INSERT INTO match_goal_events(match_id,event_order,quarter_number,scorer_id,goal_type,team) VALUES (1,0,1,1,'NORMAL','A')");
        jdbc.update("INSERT INTO match_save_requests(team_id,actor_account_id,request_key,request_method,request_fingerprint,match_id,result_version,completed_at) VALUES (1,123,'00000000-0000-0000-0000-000000000033','POST',?,1,5,'2026-10-15 01:00:00')", "d".repeat(64));
        var tables = List.of("players", "match_records", "match_quarters", "match_goal_events", "match_save_requests");
        var before = new LinkedHashMap<String, List<Map<String, Object>>>();
        for (String table : tables) before.put(table, jdbc.queryForList("SELECT * FROM " + table));
        var checksums = jdbc.queryForList("SELECT version,checksum FROM flyway_schema_history ORDER BY installed_rank");
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("33").load().migrate();
        for (String table : tables) {
            var after = jdbc.queryForList("SELECT * FROM " + table);
            if (table.equals("match_quarters")) after.forEach(row -> assertThat(row.remove("scoring_order")).isNull());
            assertThat(after).as(table).containsExactlyInAnyOrderElementsOf(before.get(table));
        }
        assertThat(jdbc.queryForList("SELECT version,checksum FROM flyway_schema_history WHERE version<>'33' ORDER BY installed_rank")).isEqualTo(checksums);
        jdbc.update("UPDATE match_quarters SET scoring_order='[-1,0,-1]' WHERE quarter_number=1");
        assertThat(jdbc.queryForObject("SELECT scoring_order FROM match_quarters WHERE quarter_number=1", String.class)).isEqualTo("[-1,0,-1]");
        assertThatThrownBy(() -> jdbc.update("UPDATE match_quarters SET scoring_order='invalid json' WHERE quarter_number=1"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
    }
}
