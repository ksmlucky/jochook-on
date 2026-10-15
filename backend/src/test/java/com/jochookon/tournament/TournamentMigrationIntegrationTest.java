package com.jochookon.tournament;

import static org.assertj.core.api.Assertions.*;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.mysql.MySQLContainer;

@Tag("integration") @Testcontainers
class TournamentMigrationIntegrationTest {
    @Container static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Test void v24PreservesEveryExistingValueAndReceiptWhileLeavingOldMatchesUnlinked() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("23").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()));
        jdbc.update("INSERT INTO players(id,team_id,name,position,first_choice) VALUES (1,1,'대회 이전 가상 선수','MF','CM')");
        jdbc.update("INSERT INTO match_records(id,team_id,version,played_on,kickoff,venue,opponent,notes,match_kind,recording_stage,formation_a,formation_b,score_for,score_against) VALUES (1,1,5,'2026-10-15','11:00:00','가상 구장','가상 상대','보존할 메모','EXTERNAL','COMPLETED','F4231','F4123',2,1),(2,1,3,'2026-10-14',NULL,'','','자체전 보존','INTERNAL',NULL,'F352','F343',NULL,NULL)");
        jdbc.update("INSERT INTO match_participants VALUES (1,1,'ATTENDING','PRESENT')");
        for (int q = 1; q <= 4; q++) jdbc.update("INSERT INTO match_quarters VALUES (1,?)", q);
        jdbc.update("INSERT INTO match_appearances(match_id,quarter_number,team,slot,entry_order,player_id,goals,assists) VALUES (1,1,'A','ST',0,1,2,1)");
        jdbc.update("INSERT INTO match_planned_lineups(match_id,quarter_number,team,slot,entry_order,player_id) VALUES (1,1,'A','ST',0,1)");
        jdbc.update("INSERT INTO match_save_requests(team_id,actor_account_id,request_key,request_method,request_fingerprint,match_id,result_version,completed_at) VALUES (1,123,'00000000-0000-0000-0000-000000000001','POST',?,1,5,'2026-10-15 01:00:00')", "a".repeat(64));
        var tables = List.of("players", "match_records", "match_participants", "match_quarters", "match_appearances", "match_planned_lineups", "match_save_requests");
        var before = new LinkedHashMap<String, List<Map<String, Object>>>();
        for (String table : tables) before.put(table, jdbc.queryForList("SELECT * FROM " + table));
        var checksums = jdbc.queryForList("SELECT version,checksum FROM flyway_schema_history WHERE success=1 ORDER BY installed_rank");
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("24").load().migrate();
        for (String table : tables) {
            var after = jdbc.queryForList("SELECT * FROM " + table);
            after.forEach(row -> { row.remove("tournament_id"); row.remove("tournament_stage"); });
            assertThat(after).as("original rows and columns in %s", table).containsExactlyInAnyOrderElementsOf(before.get(table));
        }
        assertThat(jdbc.queryForList("SELECT version,checksum FROM flyway_schema_history WHERE success=1 AND version<>'24' ORDER BY installed_rank"))
                .isEqualTo(checksums);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM tournaments", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records WHERE tournament_id IS NULL AND tournament_stage IS NULL", Long.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM flyway_schema_history WHERE version='24' AND success=1", Long.class)).isEqualTo(1);
    }
}
