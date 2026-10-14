package com.jochookon.team;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/** Only for isolated test databases. Never called by application startup. */
public final class TeamTestData {
    private TeamTestData() { }
    public static void seed(JdbcTemplate jdbc) {
        seedAccount(jdbc, "test-admin", "ADMIN");
        seedAccount(jdbc, "test-member", "MEMBER");
    }
    private static void seedAccount(JdbcTemplate jdbc, String username, String role) {
        String hash = new BCryptPasswordEncoder(4).encode("test-only-password");
        jdbc.update("INSERT INTO accounts (username, password_hash, role, enabled, service_admin) VALUES (?, ?, ?, 1, 0) ON DUPLICATE KEY UPDATE enabled = 1, role = ?", username, hash, role, role);
        String teamRole = role.equals("ADMIN") ? "DIRECTOR" : "MEMBER";
        jdbc.update("INSERT INTO team_memberships (team_id, account_id, role, active) SELECT 1, id, ?, 1 FROM accounts WHERE username = ? ON DUPLICATE KEY UPDATE role = ?, active = 1", teamRole, username, teamRole);
    }
}
