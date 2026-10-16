package com.jochookon.auth;

import com.jochookon.team.TeamAccessException;
import com.jochookon.team.TeamStore;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PasswordResetService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final TeamStore store;
    private final PasswordEncoder passwords;
    private final Clock clock;
    @Autowired public PasswordResetService(TeamStore store, PasswordEncoder passwords) { this(store, passwords, Clock.systemUTC()); }
    PasswordResetService(TeamStore store, PasswordEncoder passwords, Clock clock) {
        this.store = store; this.passwords = passwords; this.clock = clock;
    }
    private record Reset(long id, long accountId, String hash, long version, Instant expiresAt, Instant usedAt, Instant revokedAt) { }

    @Transactional(readOnly = true)
    public List<PasswordResetDtos.RecoveryAccount> accounts(long actor, String query) {
        requireServiceAdmin(actor);
        String search = query == null ? "" : query.strip();
        if (search.length() > 80) throw new TeamAccessException(400, "VALIDATION_ERROR", "검색어는 80자 이내로 입력해 주세요.");
        var accounts = store.jdbc().query("""
                SELECT a.id,a.username FROM accounts a WHERE a.enabled=1 AND a.service_admin=0
                AND LOCATE(?,a.username)>0
                AND EXISTS (SELECT 1 FROM team_memberships m JOIN teams t ON t.id=m.team_id
                    WHERE m.account_id=a.id AND m.active=1 AND m.role IN ('DIRECTOR','COACH') AND t.status='ACTIVE')
                ORDER BY a.username,a.id LIMIT 20
                """, (row, n) -> new PasswordResetDtos.RecoveryAccount(row.getLong("id"), row.getString("username"), List.of()), search);
        return accounts.stream().map(a -> new PasswordResetDtos.RecoveryAccount(a.id(), a.username(), teams(a.id()))).toList();
    }
    @Transactional
    public PasswordResetDtos.Issued issue(long actor, long accountId, Boolean verified) {
        requireServiceAdmin(actor);
        if (!Boolean.TRUE.equals(verified))
            throw new TeamAccessException(400, "IDENTITY_VERIFICATION_REQUIRED", "요청자의 본인 여부를 확인한 뒤 발급해 주세요.");
        var account = store.lockedAccount(accountId).filter(this::eligible)
                .orElseThrow(() -> new TeamAccessException(400, "RECOVERY_ACCOUNT_UNAVAILABLE", "재설정 링크를 발급할 운영진 계정을 확인해 주세요."));
        Instant now = clock.instant();
        revokeOutstanding(accountId, now);
        byte[] bytes = new byte[32]; RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expiry = now.plus(Duration.ofMinutes(30));
        store.jdbc().update("""
                INSERT INTO account_password_resets(account_id,issued_by,token_hash,credential_version,created_at,expires_at)
                VALUES (?,?,?,?,?,?)
                """, accountId, actor, hash(token), account.credentialVersion(), Timestamp.from(now), Timestamp.from(expiry));
        return new PasswordResetDtos.Issued(token, expiry, account.username());
    }
    @Transactional(readOnly = true)
    public PasswordResetDtos.Inspected inspect(String token) {
        Reset reset = find(token, false).orElseThrow(PasswordResetService::invalid);
        var account = store.account(reset.accountId()).orElseThrow(PasswordResetService::invalid);
        validate(reset, account);
        return new PasswordResetDtos.Inspected(account.username(), reset.expiresAt());
    }
    @Transactional
    public void complete(String token, String newPassword) {
        Reset preview = find(token, false).orElseThrow(PasswordResetService::invalid);
        // Every mutation locks account first, then its tokens, including issue/reissue.
        var account = store.lockedAccount(preview.accountId()).orElseThrow(PasswordResetService::invalid);
        Reset reset = find(token, true).orElseThrow(PasswordResetService::invalid);
        validate(reset, account);
        PasswordPolicy.validate(newPassword);
        if (passwords.matches(newPassword, account.passwordHash()))
            throw new TeamAccessException(400, "PASSWORD_UNCHANGED", "현재 비밀번호와 다른 비밀번호를 입력해 주세요.");
        Instant now = clock.instant();
        store.jdbc().update("UPDATE accounts SET password_hash=?,credential_version=credential_version+1 WHERE id=?", passwords.encode(newPassword), account.id());
        store.jdbc().update("UPDATE account_password_resets SET used_at=? WHERE id=?", Timestamp.from(now), reset.id());
        revokeOutstanding(account.id(), now);
    }
    private void requireServiceAdmin(long actor) {
        if (store.account(actor).filter(a -> a.enabled() && a.serviceAdmin()).isEmpty())
            throw new TeamAccessException(403, "FORBIDDEN", "서비스 관리자만 계정 복구를 관리할 수 있습니다.");
    }
    private List<PasswordResetDtos.Team> teams(long id) {
        return store.jdbc().query("""
                SELECT t.id,t.name,m.role FROM team_memberships m JOIN teams t ON t.id=m.team_id
                WHERE m.account_id=? AND m.active=1 AND m.role IN ('DIRECTOR','COACH') AND t.status='ACTIVE' ORDER BY t.id
                """, (row, n) -> new PasswordResetDtos.Team(row.getLong("id"), row.getString("name"), row.getString("role")), id);
    }
    private boolean eligible(TeamStore.AccountInfo account) { return account.enabled() && !account.serviceAdmin() && !teams(account.id()).isEmpty(); }
    private void validate(Reset reset, TeamStore.AccountInfo account) {
        if (reset.accountId() != account.id() || reset.usedAt() != null || reset.revokedAt() != null
                || !clock.instant().isBefore(reset.expiresAt()) || reset.version() != account.credentialVersion() || !eligible(account)) throw invalid();
    }
    private Optional<Reset> find(String token, boolean lock) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) throw invalid();
        return store.jdbc().query("SELECT * FROM account_password_resets WHERE token_hash=?" + (lock ? " FOR UPDATE" : ""),
                PasswordResetService::reset, hash(token)).stream().findFirst();
    }
    private void revokeOutstanding(long accountId, Instant now) {
        store.jdbc().update("UPDATE account_password_resets SET revoked_at=? WHERE account_id=? AND used_at IS NULL AND revoked_at IS NULL", Timestamp.from(now), accountId);
    }
    static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
    private static Reset reset(ResultSet row, int n) throws SQLException {
        return new Reset(row.getLong("id"), row.getLong("account_id"), row.getString("token_hash"), row.getLong("credential_version"),
                row.getTimestamp("expires_at").toInstant(), instant(row, "used_at"), instant(row, "revoked_at"));
    }
    private static Instant instant(ResultSet row, String column) throws SQLException { Timestamp value = row.getTimestamp(column); return value == null ? null : value.toInstant(); }
    private static TeamAccessException invalid() { return new TeamAccessException(400, "RESET_LINK_INVALID", "재설정 링크가 유효하지 않습니다. 서비스 관리자에게 새 링크를 요청해 주세요."); }
}
