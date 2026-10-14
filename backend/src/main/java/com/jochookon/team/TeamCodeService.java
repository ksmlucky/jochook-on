package com.jochookon.team;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class TeamCodeService {
    private final TeamStore store;
    private final PasswordEncoder passwords;
    private final TeamCodeAttemptLimiter attempts;
    private final String dummyPasswordHash;
    public TeamCodeService(TeamStore store, PasswordEncoder passwords, TeamCodeAttemptLimiter attempts) {
        this.store = store; this.passwords = passwords; this.attempts = attempts;
        this.dummyPasswordHash = passwords.encode(AccessTokens.invite());
    }
    public record VerifiedCode(TeamStore.CodeInfo code, TeamDtos.Team team) { }
    public VerifiedCode verify(String input, String password) {
        String code = AccessTokens.normalizeCode(input);
        if (!code.matches("[A-HJ-NP-Z2-9]{12}")) {
            passwords.matches("000000", dummyPasswordHash);
            throw invalidCode();
        }
        String hash = AccessTokens.hash(code);
        return attempts.attempt(hash, () -> {
            TeamStore.CodeInfo saved = store.codeByHash(hash).orElse(null);
            boolean validFormat = password != null && password.matches("[0-9]{6}");
            String storedHash = saved != null && hasPassword(saved) ? saved.passwordHash() : dummyPasswordHash;
            boolean matches = passwords.matches(validFormat ? password : "not-a-six-digit-password", storedHash);
            if (!validFormat || saved == null || !matches || !status(saved, Instant.now()).equals("ACTIVE")) throw invalidCode();
            TeamDtos.Team team = store.team(saved.teamId()).filter(t -> t.status().equals("ACTIVE")).orElseThrow(TeamCodeService::invalidCode);
            return new VerifiedCode(saved, team);
        });
    }
    public TeamDtos.CodeState state(long teamId) {
        var code = store.code(teamId).orElseThrow(() -> new TeamAccessException(404, "NOT_FOUND", "요청한 정보를 확인할 수 없습니다."));
        return response(code);
    }
    public List<TeamDtos.CodeHistoryEntry> history(long teamId, int limit) {
        if (limit < 1 || limit > 100) throw new TeamAccessException(400, "VALIDATION_ERROR", "조회할 이력 수는 1~100개여야 합니다.");
        return store.jdbc().query("""
                SELECT e.id, e.action, a.username, e.version, e.occurred_at, e.expires_at
                FROM team_code_events e JOIN accounts a ON a.id = e.actor_account_id
                WHERE e.team_id = ? ORDER BY e.occurred_at DESC, e.id DESC LIMIT ?
                """, (row, number) -> new TeamDtos.CodeHistoryEntry(row.getLong("id"), row.getString("action"), row.getString("username"),
                        row.getLong("version"), TeamStore.instant(row, "occurred_at"), TeamStore.instant(row, "expires_at")), teamId, limit);
    }
    @Transactional
    public TeamDtos.CodeIssued issue(long teamId, long accountId, long expectedVersion) {
        var old = lock(teamId, accountId, expectedVersion);
        Instant now = Instant.now();
        String code;
        do { code = AccessTokens.code(); } while (AccessTokens.hash(code).equals(old.hash()));
        String password;
        do { password = AccessTokens.codePassword(); } while (hasPassword(old) && passwords.matches(password, old.passwordHash()));
        Instant expires = now.plus(Duration.ofDays(90));
        store.jdbc().update("UPDATE team_codes SET code_hash = ?, password_hash = ?, version = version + 1, issued_at = ?, expires_at = ?, revoked_at = NULL, issued_by = ? WHERE team_id = ?",
                AccessTokens.hash(code), passwords.encode(password), Timestamp.from(now), Timestamp.from(expires), accountId, teamId);
        appendEvent(teamId, accountId, old.issuedAt() == null ? "ISSUED" : "ROTATED", old.version() + 1, now, expires);
        return new TeamDtos.CodeIssued("ACTIVE", old.version() + 1, now, expires, AccessTokens.formatted(code), password);
    }
    @Transactional
    public TeamDtos.CodeState revoke(long teamId, long accountId, long expectedVersion) {
        var old = lock(teamId, accountId, expectedVersion);
        Instant now = Instant.now();
        store.jdbc().update("UPDATE team_codes SET code_hash = NULL, password_hash = NULL, version = version + 1, revoked_at = ? WHERE team_id = ?", Timestamp.from(now), teamId);
        appendEvent(teamId, accountId, "REVOKED", old.version() + 1, now, old.expiresAt());
        return new TeamDtos.CodeState("REVOKED", old.version() + 1, old.issuedAt(), old.expiresAt());
    }
    private void appendEvent(long teamId, long accountId, String action, long version, Instant occurredAt, Instant expiresAt) {
        // Only append events; changing a code and recording its event must commit or roll back together.
        store.jdbc().update("INSERT INTO team_code_events (team_id, actor_account_id, action, version, occurred_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
                teamId, accountId, action, version, Timestamp.from(occurredAt), expiresAt == null ? null : Timestamp.from(expiresAt));
    }
    private TeamStore.CodeInfo lock(long teamId, long accountId, long version) {
        var teams = store.jdbc().query("SELECT * FROM teams WHERE id = ? FOR UPDATE", TeamStore::team, teamId);
        if (teams.isEmpty() || !teams.getFirst().status().equals("ACTIVE")) throw new TeamAccessException(403, "TEAM_FORBIDDEN", "이 팀에 접근할 수 없습니다.");
        store.requireActiveRole(accountId, teamId, true, "DIRECTOR", "COACH");
        var rows = store.jdbc().query("SELECT * FROM team_codes WHERE team_id = ? FOR UPDATE", TeamStore::code, teamId);
        if (rows.isEmpty() || rows.getFirst().version() != version)
            throw new TeamAccessException(409, "CODE_CHANGED", "코드 상태가 변경되었습니다. 최신 상태를 확인해 주세요.");
        return rows.getFirst();
    }
    private static TeamDtos.CodeState response(TeamStore.CodeInfo code) {
        return new TeamDtos.CodeState(status(code, Instant.now()), code.version(), code.issuedAt(), code.expiresAt());
    }
    static String status(TeamStore.CodeInfo code, Instant now) {
        if (code.revokedAt() != null) return "REVOKED";
        if (code.hash() == null || code.issuedAt() == null) return "NONE";
        if (!hasPassword(code)) return "REVOKED";
        return code.expiresAt() != null && now.isBefore(code.expiresAt()) ? "ACTIVE" : "EXPIRED";
    }
    private static boolean hasPassword(TeamStore.CodeInfo code) { return code.passwordHash() != null && !code.passwordHash().isBlank(); }
    private static TeamAccessException invalidCode() { return new TeamAccessException(401, "INVALID_CODE", "팀 코드 또는 팀 비밀번호를 확인해 주세요. 운영진에게 받은 최신 정보를 입력해 주세요."); }
}
