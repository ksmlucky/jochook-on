package com.jochookon.auth;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.jochookon.team.TeamAccessException;
import com.jochookon.team.TeamStore;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class PasswordChangeServiceTest {
    private final TeamStore store = mock(TeamStore.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final PasswordChangeService service = new PasswordChangeService(store, encoder);
    private static final String CURRENT = "test-current-password";
    @BeforeEach void setup() {
        when(store.lockedAccount(5)).thenReturn(Optional.of(new TeamStore.AccountInfo(5, "test-account", encoder.encode(CURRENT), true, false, 3)));
        when(store.jdbc()).thenReturn(jdbc);
    }
    @Test void hashesReplacementAndIncrementsVersionWithoutChangingOtherAccounts() {
        service.change(5, 3, CURRENT, "test-next-password");
        var encoded = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc).update(eq("UPDATE accounts SET password_hash = ?, credential_version = credential_version + 1 WHERE id = ?"), encoded.capture(), eq(5L));
        assertThat(encoder.matches("test-next-password", encoded.getValue())).isTrue();
        assertThat(encoded.getValue()).doesNotContain("test-next-password");
    }
    @Test void wrongCurrentPasswordIsDistinctAndNeverWrites() {
        expectCode("CURRENT_PASSWORD_INCORRECT", 3, "wrong", "test-next-password");
        expectCode("CURRENT_PASSWORD_INCORRECT", 3, null, "test-next-password");
        verifyNoInteractions(jdbc);
    }
    @Test void staleSessionAndDisabledAccountAreRejectedBeforePasswordChange() {
        expectCode("SESSION_EXPIRED", 2, CURRENT, "test-next-password");
        when(store.lockedAccount(5)).thenReturn(Optional.of(new TeamStore.AccountInfo(5, "test-account", "hash", false, false, 3)));
        expectCode("SESSION_EXPIRED", 3, CURRENT, "test-next-password");
        verifyNoInteractions(jdbc);
    }
    @Test void enforcesLengthBytesAndDifferentPassword() {
        expectCode("INVALID_NEW_PASSWORD", 3, CURRENT, "short");
        expectCode("INVALID_NEW_PASSWORD", 3, CURRENT, "가".repeat(25));
        expectCode("INVALID_NEW_PASSWORD", 3, CURRENT, "a".repeat(73));
        expectCode("INVALID_NEW_PASSWORD", 3, CURRENT, "😀".repeat(6));
        expectCode("PASSWORD_UNCHANGED", 3, CURRENT, CURRENT);
        verifyNoInteractions(jdbc);
        service.change(5, 3, CURRENT, "가".repeat(24));
        verify(jdbc).update(anyString(), anyString(), eq(5L));
    }
    @Test void dtoNeverRendersCredentials() {
        assertThat(new AuthController.PasswordChangeInput(CURRENT, "test-next-password").toString()).isEqualTo("PasswordChangeInput[REDACTED]");
    }
    private void expectCode(String code, long version, String current, String next) {
        assertThatThrownBy(() -> service.change(5, version, current, next)).isInstanceOf(TeamAccessException.class)
                .extracting(e -> ((TeamAccessException) e).code()).isEqualTo(code);
    }
}
