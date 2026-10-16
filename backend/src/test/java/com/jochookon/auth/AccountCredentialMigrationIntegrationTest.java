package com.jochookon.auth;

import static org.assertj.core.api.Assertions.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.mysql.MySQLContainer;

@Tag("integration") @Testcontainers
class AccountCredentialMigrationIntegrationTest {
    @Container static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Test void v29PreservesCredentialsRolesAndMembershipsAndStartsVersionAtZero() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("28").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()));
        jdbc.update("INSERT INTO accounts(id,username,password_hash,role,enabled,service_admin) VALUES (901,'migration-test','synthetic-hash','ADMIN',1,1)");
        jdbc.update("INSERT INTO team_memberships(team_id,account_id,role,active) VALUES (1,901,'DIRECTOR',1)");
        var accounts = jdbc.queryForList("SELECT * FROM accounts ORDER BY id");
        var memberships = jdbc.queryForList("SELECT * FROM team_memberships ORDER BY id");
        var checksums = jdbc.queryForList("SELECT version,checksum FROM flyway_schema_history ORDER BY installed_rank");
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("29").load().migrate();
        var after = jdbc.queryForList("SELECT * FROM accounts ORDER BY id");
        after.forEach(row -> { assertThat(((Number) row.remove("credential_version")).longValue()).isZero(); });
        assertThat(after).isEqualTo(accounts);
        assertThat(jdbc.queryForList("SELECT * FROM team_memberships ORDER BY id")).isEqualTo(memberships);
        assertThat(jdbc.queryForList("SELECT version,checksum FROM flyway_schema_history WHERE version<>'29' ORDER BY installed_rank")).isEqualTo(checksums);
        assertThatThrownBy(() -> jdbc.update("UPDATE accounts SET credential_version=NULL WHERE id=901"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
    }
}
