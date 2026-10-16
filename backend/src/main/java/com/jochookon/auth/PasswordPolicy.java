package com.jochookon.auth;

import com.jochookon.team.TeamAccessException;
import java.nio.charset.StandardCharsets;

final class PasswordPolicy {
    private PasswordPolicy() { }
    static void validate(String password) {
        if (password == null || password.codePointCount(0, password.length()) < 12
                || password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new TeamAccessException(400, "INVALID_NEW_PASSWORD", "새 비밀번호는 12자 이상, UTF-8 기준 72바이트 이하여야 합니다.");
    }
}
