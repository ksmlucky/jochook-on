package com.jochookon.auth;

import static org.assertj.core.api.Assertions.*;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.mysql.MySQLContainer;

@Tag("integration") @Testcontainers
class PasswordResetMigrationIntegrationTest {
    @Container static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Test void v30PreservesExistingAccountsAndAddsEmptyResetStoreWithKeys() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("29").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()));
        jdbc.update("INSERT INTO accounts(id,username,password_hash,role,enabled,service_admin,credential_version) VALUES (901,'reset-owner','synthetic-owner-hash','ADMIN',1,1,2),(902,'reset-target','synthetic-target-hash','ADMIN',1,0,4)");
        var before = jdbc.queryForList("SELECT * FROM accounts ORDER BY id");
        var checksums = jdbc.queryForList("SELECT version,checksum FROM flyway_schema_history ORDER BY installed_rank");
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("30").load().migrate();
        assertThat(jdbc.queryForList("SELECT * FROM accounts ORDER BY id")).isEqualTo(before);
        assertThat(jdbc.queryForList("SELECT version,checksum FROM flyway_schema_history WHERE version<>'30' ORDER BY installed_rank")).isEqualTo(checksums);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM account_password_resets", Integer.class)).isZero();
        String sql = "INSERT INTO account_password_resets(account_id,issued_by,token_hash,credential_version,created_at,expires_at) VALUES (?,?,?,4,NOW(6),DATE_ADD(NOW(6),INTERVAL 30 MINUTE))";
        jdbc.update(sql,902,901,"a".repeat(64));
        assertThatThrownBy(() -> jdbc.update(sql,902,901,"a".repeat(64))).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update(sql,99999,901,"b".repeat(64))).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update(sql,902,99999,"b".repeat(64))).isInstanceOf(org.springframework.dao.DataAccessException.class);
    }
}
