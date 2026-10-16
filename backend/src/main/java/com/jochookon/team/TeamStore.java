package com.jochookon.team;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class TeamStore {
    private final JdbcTemplate jdbc;
    public TeamStore(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public JdbcTemplate jdbc() { return jdbc; }
    public record AccountInfo(long id, String username, String passwordHash, boolean enabled, boolean serviceAdmin, long credentialVersion) { }
    public record CodeInfo(long teamId, String hash, String passwordHash, long version, Instant issuedAt, Instant expiresAt, Instant revokedAt) { }
    public record InviteInfo(long id, long teamId, String label, String hash, long version, Instant expiresAt, Instant usedAt, Instant cancelledAt, String role, long createdBy) { }

    public Optional<AccountInfo> account(long id) {
        return jdbc.query("SELECT * FROM accounts WHERE id = ?", TeamStore::account, id).stream().findFirst();
    }
    public Optional<AccountInfo> account(String username) {
        return jdbc.query("SELECT * FROM accounts WHERE username = ?", TeamStore::account, username).stream().findFirst();
    }
    public Optional<AccountInfo> lockedAccount(long id) {
        return jdbc.query("SELECT * FROM accounts WHERE id = ? FOR UPDATE", TeamStore::account, id).stream().findFirst();
    }
    public Optional<TeamDtos.Team> team(long id) {
        return jdbc.query("SELECT * FROM teams WHERE id = ?", TeamStore::team, id).stream().findFirst();
    }
    public List<TeamDtos.MyTeam> memberships(long accountId) {
        return jdbc.query("""
                SELECT t.*, m.role FROM teams t JOIN team_memberships m ON m.team_id = t.id
                WHERE m.account_id = ? AND m.active = 1 AND t.status = 'ACTIVE' ORDER BY t.id
                """, (r, n) -> new TeamDtos.MyTeam(r.getLong("id"), r.getString("name"), r.getString("description"), r.getString("status"), r.getString("role")), accountId);
    }
    public Optional<CodeInfo> code(long teamId) {
        return jdbc.query("SELECT * FROM team_codes WHERE team_id = ?", TeamStore::code, teamId).stream().findFirst();
    }
    public Optional<CodeInfo> codeByHash(String hash) {
        return jdbc.query("SELECT * FROM team_codes WHERE code_hash = ?", TeamStore::code, hash).stream().findFirst();
    }
    public Optional<InviteInfo> inviteByHash(String hash, boolean lock) {
        return jdbc.query("SELECT * FROM team_invites WHERE token_hash = ?" + (lock ? " FOR UPDATE" : ""), TeamStore::invite, hash).stream().findFirst();
    }
    public void bootstrapMembership(long accountId) {
        jdbc.update("INSERT INTO team_memberships (team_id, account_id, role, active) VALUES (1, ?, 'COACH', 1) ON DUPLICATE KEY UPDATE active = active", accountId);
    }
    void requireActiveRole(long actor, long teamId, boolean lock, String... allowed) {
        var roles = jdbc.queryForList("SELECT m.role FROM team_memberships m JOIN accounts a ON a.id=m.account_id "
                + "WHERE m.team_id=? AND m.account_id=? AND m.active=1 AND a.enabled=1" + (lock ? " FOR UPDATE" : ""), String.class, teamId, actor);
        if (roles.isEmpty() || java.util.Arrays.stream(allowed).noneMatch(roles.getFirst()::equals))
            throw new TeamAccessException(403, "FORBIDDEN", "이 작업에 접근할 수 없습니다.");
    }
    static AccountInfo account(ResultSet r, int n) throws SQLException {
        return new AccountInfo(r.getLong("id"), r.getString("username"), r.getString("password_hash"), r.getBoolean("enabled"), r.getBoolean("service_admin"), r.getLong("credential_version"));
    }
    static TeamDtos.Team team(ResultSet r, int n) throws SQLException {
        return new TeamDtos.Team(r.getLong("id"), r.getString("name"), r.getString("description"), r.getString("status"));
    }
    static CodeInfo code(ResultSet r, int n) throws SQLException {
        return new CodeInfo(r.getLong("team_id"), r.getString("code_hash"), r.getString("password_hash"), r.getLong("version"), instant(r, "issued_at"), instant(r, "expires_at"), instant(r, "revoked_at"));
    }
    static InviteInfo invite(ResultSet r, int n) throws SQLException {
        return new InviteInfo(r.getLong("id"), r.getLong("team_id"), r.getString("display_name"), r.getString("token_hash"), r.getLong("version"), instant(r, "expires_at"), instant(r, "used_at"), instant(r, "cancelled_at"), r.getString("role"), r.getLong("created_by"));
    }
    static Instant instant(ResultSet r, String column) throws SQLException {
        Timestamp time = r.getTimestamp(column); return time == null ? null : time.toInstant();
    }
}
