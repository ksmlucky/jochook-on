package com.jochookon.team;

import static org.assertj.core.api.Assertions.*;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

@Tag("integration")
@Testcontainers
class TeamCodeMigrationIntegrationTest {
    @Container static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");

    @Test void upgradeRevokesLegacyCodesAndVersionsButPreservesUnissuedRowsAndOriginalIssueMetadata() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("16").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()));
        jdbc.update("INSERT INTO teams(id,name,status) VALUES (2,'Expired test club','ACTIVE'),(3,'Revoked test club','ACTIVE'),(4,'Unissued test club','ACTIVE')");
        jdbc.update("UPDATE team_codes SET code_hash=?,version=2,issued_at='2026-01-01',expires_at='2030-01-01' WHERE team_id=1", AccessTokens.hash("legacy-active"));
        jdbc.update("INSERT INTO team_codes(team_id,code_hash,version,issued_at,expires_at,revoked_at) VALUES (2,?,3,'2026-01-01','2026-02-01',NULL),(3,NULL,4,'2026-01-01','2026-02-01','2026-01-10'),(4,NULL,0,NULL,NULL,NULL)", AccessTokens.hash("legacy-expired"));
        var originalTeams = jdbc.queryForList("SELECT * FROM teams ORDER BY id");
        var originalIssueMetadata = jdbc.queryForList("SELECT team_id,issued_at,expires_at,issued_by FROM team_codes ORDER BY team_id");
        var originalRevokedAt = jdbc.queryForObject("SELECT revoked_at FROM team_codes WHERE team_id=3", java.sql.Timestamp.class);

        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).load().migrate();

        assertThat(jdbc.queryForList("SELECT * FROM teams ORDER BY id")).isEqualTo(originalTeams);
        assertThat(jdbc.queryForList("SELECT team_id,issued_at,expires_at,issued_by FROM team_codes ORDER BY team_id")).isEqualTo(originalIssueMetadata);
        assertThat(jdbc.queryForList("SELECT version FROM team_codes ORDER BY team_id", Long.class)).containsExactly(3L, 4L, 4L, 0L);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM team_codes WHERE code_hash IS NOT NULL OR password_hash IS NOT NULL", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM team_codes WHERE team_id IN (1,2,3) AND revoked_at IS NOT NULL", Integer.class)).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT revoked_at FROM team_codes WHERE team_id=3", java.sql.Timestamp.class)).isEqualTo(originalRevokedAt);
        assertThat(jdbc.queryForObject("SELECT revoked_at FROM team_codes WHERE team_id=4", Object.class)).isNull();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM team_code_events", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='team_codes' AND COLUMN_NAME='password_hash'", Long.class)).isEqualTo(100L);
        assertThat(jdbc.queryForObject("SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='team_codes' AND COLUMN_NAME='password_hash'", String.class)).isEqualTo("YES");
    }
}
