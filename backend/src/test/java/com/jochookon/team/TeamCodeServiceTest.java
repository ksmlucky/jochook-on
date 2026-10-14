package com.jochookon.team;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class TeamCodeServiceTest {
    private static final String CODE = "ABCD2345EFGH";
    private final TeamStore store = mock(TeamStore.class);
    private final PasswordEncoder passwords = mock(PasswordEncoder.class);
    private TeamCodeService codes;

    @BeforeEach void setup() {
        when(passwords.encode(anyString())).thenReturn("dummy-hash");
        codes = new TeamCodeService(store, passwords, new TeamCodeAttemptLimiter());
    }
    @Test void bothCredentialsAreRequiredAndAsciiLeadingZeroPasswordIsPreserved() {
        var saved = code("stored-hash");
        when(store.codeByHash(AccessTokens.hash(CODE))).thenReturn(Optional.of(saved));
        when(passwords.matches("000007", "stored-hash")).thenReturn(true);
        when(store.team(1)).thenReturn(Optional.of(new TeamDtos.Team(1, "Test club", "", "ACTIVE")));
        assertThat(codes.verify(" abcd-2345-efgh ", "000007").code()).isEqualTo(saved);
        for (String invalid : new String[]{null, "", "00007", "0000007", "１２３４５６", "١٢٣٤٥٦", " 000007", "000007 "}) {
            assertInvalid(() -> codes.verify(CODE, invalid));
        }
        verify(store, times(1)).team(1);
        verify(passwords).matches("000007", "stored-hash");
    }
    @Test void missingAndPasswordlessLegacyCodesUseDummyBcryptAndNeverRevealTeam() {
        when(store.codeByHash(AccessTokens.hash(CODE))).thenReturn(Optional.empty(), Optional.of(code(null)));
        assertInvalid(() -> codes.verify(CODE, "000007"));
        assertInvalid(() -> codes.verify(CODE, "000007"));
        verify(passwords, times(2)).matches("000007", "dummy-hash");
        verify(store, never()).team(anyLong());
    }
    @Test void malformedCodesHaveTheSameFailureAndPerformDummyPasswordVerification() {
        assertInvalid(() -> codes.verify(null, "000007"));
        assertInvalid(() -> codes.verify("invalid", "000007"));
        verify(passwords, times(2)).matches("000000", "dummy-hash");
        verifyNoInteractions(store);
    }
    @Test void generatedPasswordsHaveSixAsciiDigitsAndRecordLoggingRedactsCredentials() {
        for (int i = 0; i < 32; i++) assertThat(AccessTokens.codePassword()).matches("[0-9]{6}");
        var input = new TeamDtos.CodeInput(CODE, "000000");
        var issued = new TeamDtos.CodeIssued("ACTIVE", 1, Instant.now(), Instant.now(), CODE, "000000");
        assertThat(input.password()).isEqualTo("000000");
        assertThat(issued.password()).isEqualTo("000000");
        assertThat(input.toString()).doesNotContain(CODE, "000000");
        assertThat(issued.toString()).doesNotContain(CODE, "000000");
    }
    private static TeamStore.CodeInfo code(String passwordHash) {
        Instant now = Instant.now();
        return new TeamStore.CodeInfo(1, AccessTokens.hash(CODE), passwordHash, 1, now, now.plus(Duration.ofDays(90)), null);
    }
    private static void assertInvalid(Runnable action) {
        assertThatThrownBy(action::run).isInstanceOf(TeamAccessException.class).satisfies(error -> {
            TeamAccessException invalid = (TeamAccessException) error;
            assertThat(invalid.status()).isEqualTo(401);
            assertThat(invalid.code()).isEqualTo("INVALID_CODE");
            assertThat(invalid.getMessage()).startsWith("팀 코드 또는 팀 비밀번호를 확인해 주세요.");
        });
    }
}
