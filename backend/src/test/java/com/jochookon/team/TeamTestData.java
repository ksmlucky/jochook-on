package com.jochookon.team;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.test.context.TestSecurityContextHolder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import java.time.Instant;

/** Only for isolated test databases. Never called by application startup. */
public final class TeamTestData {
    private TeamTestData() { }
    public static void seed(JdbcTemplate jdbc) {
        seedAccount(jdbc, "test-admin", "ADMIN");
        seedAccount(jdbc, "test-member", "MEMBER");
    }
    /**
     * Completes a feature test's mocked principal with the session that a fresh login creates.
     * Apply last, after with(user(...)), so per-request member/director overrides are preserved.
     * Authentication and expiry tests use real login instead; this never upgrades an existing session.
     */
    public static RequestPostProcessor accountSession(JdbcTemplate jdbc) {
        return request -> {
            var session = request.getSession(true);
            if (session.getAttribute(TeamSessionService.SESSION_KEY) != null) return request;
            var stored = session.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
            SecurityContext context = stored instanceof SecurityContext existing ? existing : TestSecurityContextHolder.getContext();
            var authentication = context.getAuthentication();
            if (authentication == null || !authentication.isAuthenticated())
                throw new AssertionError("Feature fixture requires an explicit mocked account principal");
            var account = jdbc.queryForMap("SELECT id, credential_version FROM accounts WHERE username=?", authentication.getName());
            session.setAttribute(TeamSessionService.SESSION_KEY, new TeamSessionService.SessionState(
                    "ACCOUNT", ((Number) account.get("id")).longValue(), 1L, 0, Instant.now(),
                    ((Number) account.get("credential_version")).longValue()));
            return SecurityMockMvcRequestPostProcessors.securityContext(context).postProcessRequest(request);
        };
    }
    private static void seedAccount(JdbcTemplate jdbc, String username, String role) {
        String hash = new BCryptPasswordEncoder(4).encode("test-only-password");
        jdbc.update("INSERT INTO accounts (username, password_hash, role, enabled, service_admin) VALUES (?, ?, ?, 1, 0) ON DUPLICATE KEY UPDATE enabled = 1, role = ?", username, hash, role, role);
        String teamRole = role.equals("ADMIN") ? "DIRECTOR" : "MEMBER";
        jdbc.update("INSERT INTO team_memberships (team_id, account_id, role, active) SELECT 1, id, ?, 1 FROM accounts WHERE username = ? ON DUPLICATE KEY UPDATE role = ?, active = 1", teamRole, username, teamRole);
    }
}
