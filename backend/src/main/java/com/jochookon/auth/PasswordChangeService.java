package com.jochookon.auth;

import com.jochookon.team.TeamAccessException;
import com.jochookon.team.TeamStore;
import java.nio.charset.StandardCharsets;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PasswordChangeService {
    private final TeamStore store;
    private final PasswordEncoder passwords;
    public PasswordChangeService(TeamStore store, PasswordEncoder passwords) {
        this.store = store; this.passwords = passwords;
    }

    @Transactional
    public void change(long accountId, long sessionVersion, String currentPassword, String newPassword) {
        var account = store.lockedAccount(accountId).filter(TeamStore.AccountInfo::enabled)
                .orElseThrow(() -> new TeamAccessException(401, "SESSION_EXPIRED", "다시 로그인해 주세요."));
        if (account.credentialVersion() != sessionVersion)
            throw new TeamAccessException(401, "SESSION_EXPIRED", "비밀번호가 변경되었습니다. 다시 로그인해 주세요.");
        if (currentPassword == null || currentPassword.getBytes(StandardCharsets.UTF_8).length > 72
                || !passwords.matches(currentPassword, account.passwordHash()))
            throw new TeamAccessException(400, "CURRENT_PASSWORD_INCORRECT", "현재 비밀번호가 맞지 않습니다.");
        if (newPassword == null || newPassword.codePointCount(0, newPassword.length()) < 12
                || newPassword.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new TeamAccessException(400, "INVALID_NEW_PASSWORD", "새 비밀번호는 12자 이상, UTF-8 기준 72바이트 이하여야 합니다.");
        if (passwords.matches(newPassword, account.passwordHash()))
            throw new TeamAccessException(400, "PASSWORD_UNCHANGED", "현재 비밀번호와 다른 비밀번호를 입력해 주세요.");
        store.jdbc().update("UPDATE accounts SET password_hash = ?, credential_version = credential_version + 1 WHERE id = ?",
                passwords.encode(newPassword), accountId);
    }
}
