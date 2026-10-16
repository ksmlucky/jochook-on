package com.jochookon.team;

import static org.assertj.core.api.Assertions.*;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import java.sql.SQLException;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

@Tag("integration") @Testcontainers
class TeamRoleMigrationIntegrationTest {
    @Container static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Test void legacyAdministratorsAndInvitationsBecomeCoachesWithoutElevatingAnyoneOrChangingAccounts() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("17").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()));
        jdbc.update("INSERT INTO accounts(id,username,password_hash,role,enabled,service_admin) VALUES (101,'legacy-operator','test-only-hash','ADMIN',1,1),(102,'legacy-member','test-only-hash','MEMBER',1,0),(103,'inactive-operator','test-only-hash','ADMIN',1,0)");
        jdbc.update("INSERT INTO team_memberships(id,team_id,account_id,role,active) VALUES(201,1,101,'ADMIN',1),(202,1,102,'MEMBER',1),(203,1,103,'ADMIN',0)");
        jdbc.update("INSERT INTO team_invites(id,team_id,display_name,token_hash,expires_at,used_at,created_by) VALUES (301,1,'Pending operator',?,'2030-01-01',NULL,101),(302,1,'Accepted operator',?,'2030-01-01','2026-10-14',101)", AccessTokens.hash("test-pending-invitation"), AccessTokens.hash("test-accepted-invitation"));
        var accounts = jdbc.queryForList("SELECT * FROM accounts ORDER BY id");
        var memberships = jdbc.queryForList("SELECT id,team_id,account_id,active,created_at FROM team_memberships ORDER BY id");
        var invitations = jdbc.queryForList("SELECT * FROM team_invites ORDER BY id");
        var codes = jdbc.queryForList("SELECT * FROM team_codes ORDER BY team_id");

        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).load().migrate();

        var afterAccounts = jdbc.queryForList("SELECT * FROM accounts ORDER BY id");
        afterAccounts.forEach(row -> assertThat(((Number) row.remove("credential_version")).longValue()).isZero());
        assertThat(afterAccounts).isEqualTo(accounts);
        assertThat(jdbc.queryForList("SELECT id,team_id,account_id,active,created_at FROM team_memberships ORDER BY id")).isEqualTo(memberships);
        assertThat(jdbc.queryForList("SELECT role FROM team_memberships ORDER BY id", String.class)).containsExactly("COACH", "MEMBER", "COACH");
        var afterInvitations = jdbc.queryForList("SELECT * FROM team_invites ORDER BY id");
        afterInvitations.forEach(row -> assertThat(row.remove("role")).isEqualTo("COACH"));
        assertThat(afterInvitations).isEqualTo(invitations);
        assertThat(jdbc.queryForList("SELECT * FROM team_codes ORDER BY team_id")).isEqualTo(codes);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM team_memberships WHERE role='DIRECTOR'", Integer.class)).isZero();
        assertCheckViolation(() -> jdbc.update("UPDATE team_memberships SET role='ADMIN' WHERE id=201"), "chk_membership_role");
        assertCheckViolation(() -> jdbc.update("UPDATE team_invites SET role='MEMBER' WHERE id=301"), "chk_invite_role");
    }
    private static void assertCheckViolation(Runnable update, String constraint) {
        assertThatThrownBy(update::run).isInstanceOf(DataAccessException.class).hasMessageContaining(constraint).satisfies(error -> {
            Throwable cause = ((DataAccessException) error).getRootCause();
            assertThat(cause).isInstanceOf(SQLException.class);
            assertThat(((SQLException) cause).getErrorCode()).isEqualTo(3819);
        });
    }
}
