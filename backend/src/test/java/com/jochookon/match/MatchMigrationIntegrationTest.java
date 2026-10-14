package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.mysql.MySQLContainer;

@Tag("integration") @Testcontainers
class MatchMigrationIntegrationTest {
    @Container static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Test void upgradesExistingV4LineupsToStartersWithoutChangingStats() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("4").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()));
        jdbc.update("INSERT INTO players(id,name,position) VALUES (1,'마이그레이션 검증','FW')");
        jdbc.update("INSERT INTO match_records(id,played_on,venue,opponent,notes) VALUES (1,'2026-10-13','','','')");
        jdbc.update("INSERT INTO match_records(id,played_on,kickoff,venue,opponent,notes) VALUES (2,'2026-10-13','11:15:00','','','')");
        jdbc.update("INSERT INTO match_participants VALUES (1,1,'ATTENDING','PRESENT')");
        jdbc.update("INSERT INTO match_quarters VALUES (1,1,30)");
        jdbc.update("INSERT INTO match_appearances VALUES (1,1,'ST',1,2,0)");
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("12").load().migrate();
        jdbc.update("INSERT INTO match_planned_lineups VALUES (1,1,'ST',0,1)");
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).load().migrate();
        assertThat(jdbc.queryForObject("SELECT team FROM match_appearances", String.class)).isEqualTo("A");
        assertThat(jdbc.queryForObject("SELECT team FROM match_planned_lineups", String.class)).isEqualTo("A");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records WHERE match_kind='EXTERNAL'", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT entry_order FROM match_appearances", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT goals FROM match_appearances", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT player_type FROM players WHERE id=1", String.class)).isEqualTo("MEMBER");
        assertThat(jdbc.queryForObject("SELECT kickoff FROM match_records WHERE id=1", java.sql.Time.class)).isNull();
        assertThat(jdbc.queryForObject("SELECT kickoff FROM match_records WHERE id=2", java.sql.Time.class).toLocalTime()).isEqualTo(java.time.LocalTime.of(11, 15));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records WHERE score_for IS NULL AND score_against IS NULL", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_quarters", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='match_quarters' AND column_name='duration_minutes'", Integer.class)).isZero();
    }
}
