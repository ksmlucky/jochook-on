package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.mysql.MySQLContainer;

@Tag("integration") @Testcontainers
class MatchSaveMigrationIntegrationTest {
    @Container static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");

    @Test void v23PreservesExistingRecordsAndCreatesNoPayloadOrCascadingForeignKeys() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("22").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()));
        jdbc.update("INSERT INTO match_records(team_id,played_on,kickoff,venue,opponent,notes,version) VALUES (1,'2026-10-18','07:00:00','','','가상 기록',4)");
        var before = jdbc.queryForList("SELECT * FROM match_records");
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).load().migrate();
        var after = jdbc.queryForList("SELECT * FROM match_records");
        after.forEach(row -> { row.remove("tournament_id"); row.remove("tournament_stage"); row.remove("match_format"); });
        assertThat(after).isEqualTo(before);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_save_requests", Long.class)).isZero();
        assertThat(jdbc.queryForList("SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='match_save_requests'", String.class))
                .containsExactlyInAnyOrder("team_id", "actor_account_id", "request_key", "request_method", "target_match_id", "request_fingerprint",
                        "match_id", "result_version", "created_at", "completed_at");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE() AND table_name='match_save_requests'", Long.class)).isZero();
    }
}
