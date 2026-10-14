package com.jochookon.auth;

import com.jochookon.team.TeamStore;
import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AdminBootstrap implements ApplicationRunner {
    private final AccountRepository accounts;
    private final PasswordEncoder encoder;
    private final String username;
    private final String password;
    private final String serviceAdminUsername;
    private final TeamStore teams;

    public AdminBootstrap(AccountRepository accounts, PasswordEncoder encoder, TeamStore teams,
            @Value("${jochookon.bootstrap.admin.username:}") String username,
            @Value("${jochookon.bootstrap.admin.password:}") String password,
            @Value("${jochookon.bootstrap.service-admin-username:}") String serviceAdminUsername) {
        this.accounts = accounts;
        this.encoder = encoder;
        this.username = username;
        this.password = password;
        this.serviceAdminUsername = serviceAdminUsername.strip();
        this.teams = teams;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!username.isBlank() || !password.isEmpty()) {
            // 기존 계정이나 비밀번호를 시작할 때마다 덮어쓰지 않는다.
            if (accounts.count() == 0) {
                if (username.isBlank() || password.length() < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72)
                    throw new IllegalArgumentException("초기 관리자 아이디와 12자 이상, UTF-8 72바이트 이하의 비밀번호가 필요합니다.");
                Account created = accounts.saveAndFlush(Account.create(username, encoder.encode(password), AccountRole.ADMIN));
                teams.bootstrapMembership(created.getId());
            }
        }
        // Explicit assignment only; being the first account or a team admin is never sufficient.
        if (!serviceAdminUsername.isEmpty()) {
            Account selected = accounts.findByUsername(serviceAdminUsername)
                    .filter(Account::isEnabled).orElseThrow(() -> new IllegalArgumentException("서비스 관리자로 지정할 활성 계정을 확인해 주세요."));
            selected.grantServiceAdmin();
        }
    }
}
