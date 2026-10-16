package com.jochookon.auth;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.jochookon.team.TeamAccessException;
import com.jochookon.team.TeamStore;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class PasswordResetServiceTest {
    private final TeamStore store = mock(TeamStore.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final Instant now = Instant.parse("2026-10-16T00:00:00Z");
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final PasswordResetService resets = new PasswordResetService(store, encoder, Clock.fixed(now, ZoneOffset.UTC));
    private final String token = "a".repeat(43);
    private TeamStore.AccountInfo target;
    @BeforeEach void setup() {
        when(store.jdbc()).thenReturn(jdbc);
        target = new TeamStore.AccountInfo(2, "test-coach", encoder.encode("test-original-password"), true, false, 3);
        when(store.account(1)).thenReturn(Optional.of(new TeamStore.AccountInfo(1, "test-owner", "hash", true, true, 0)));
        when(store.account(2)).thenReturn(Optional.of(target));
        when(store.lockedAccount(2)).thenReturn(Optional.of(target));
        when(jdbc.query(contains("SELECT t.id,t.name"), any(RowMapper.class), eq(2L)))
                .thenReturn(List.of(new PasswordResetDtos.Team(9, "Example club", "COACH")));
    }
    private void resetRow(Instant expiry, Instant used, Instant revoked, long version) throws Exception {
        var row = mock(ResultSet.class);
        when(row.getLong("id")).thenReturn(10L); when(row.getLong("account_id")).thenReturn(2L);
        when(row.getLong("credential_version")).thenReturn(version); when(row.getString("token_hash")).thenReturn(PasswordResetService.hash(token));
        when(row.getTimestamp("expires_at")).thenReturn(Timestamp.from(expiry));
        when(row.getTimestamp("used_at")).thenReturn(used == null ? null : Timestamp.from(used));
        when(row.getTimestamp("revoked_at")).thenReturn(revoked == null ? null : Timestamp.from(revoked));
        when(jdbc.query(startsWith("SELECT * FROM account_password_resets"), any(RowMapper.class), eq(PasswordResetService.hash(token))))
                .thenAnswer(call -> List.of(((RowMapper<?>) call.getArgument(1)).mapRow(row, 0)));
    }
    @Test void issuesRandomHashedThirtyMinuteLinkAndRevokesOlderLinks() {
        var issued = resets.issue(1, 2, true);
        assertThat(issued.token()).matches("[A-Za-z0-9_-]{43}");
        assertThat(Base64.getUrlDecoder().decode(issued.token())).hasSize(32);
        assertThat(issued.expiresAt()).isEqualTo(now.plusSeconds(1800));
        assertThat(issued.username()).isEqualTo("test-coach");
        verify(jdbc).update(startsWith("UPDATE account_password_resets SET revoked_at"), eq(Timestamp.from(now)), eq(2L));
        verify(jdbc).update(contains("INSERT INTO account_password_resets"), eq(2L), eq(1L), eq(PasswordResetService.hash(issued.token())), eq(3L), eq(Timestamp.from(now)), eq(Timestamp.from(issued.expiresAt())));
        assertThat(issued.toString()).doesNotContain(issued.token());
    }
    @Test void onlyServiceAdministratorMaySearchOrIssueAndConfirmationIsRequired() {
        assertCode(() -> resets.accounts(2, ""), "FORBIDDEN");
        assertCode(() -> resets.issue(2, 2, true), "FORBIDDEN");
        assertCode(() -> resets.issue(1, 2, false), "IDENTITY_VERIFICATION_REQUIRED");
        assertCode(() -> resets.issue(1, 2, null), "IDENTITY_VERIFICATION_REQUIRED");
        verify(store, never()).lockedAccount(anyLong());
    }
    @Test void platformAccountsAndAccountsWithoutActiveCoachingMembershipCannotReceiveLinks() {
        when(store.lockedAccount(2)).thenReturn(Optional.of(new TeamStore.AccountInfo(2, "test-admin", "hash", true, true, 3)));
        assertCode(() -> resets.issue(1, 2, true), "RECOVERY_ACCOUNT_UNAVAILABLE");
        when(store.lockedAccount(2)).thenReturn(Optional.of(target));
        when(jdbc.query(contains("SELECT t.id,t.name"), any(RowMapper.class), eq(2L))).thenReturn(List.of());
        assertCode(() -> resets.issue(1, 2, true), "RECOVERY_ACCOUNT_UNAVAILABLE");
    }
    @Test void inspectDoesNotConsumeAndInvalidReasonsHaveSameCode() throws Exception {
        resetRow(now.plusSeconds(10), null, null, 3);
        assertThat(resets.inspect(token).username()).isEqualTo("test-coach");
        verify(jdbc, never()).update(anyString(), any(Object[].class));
        resetRow(now, null, null, 3); assertCode(() -> resets.inspect(token), "RESET_LINK_INVALID");
        resetRow(now.plusSeconds(10), now, null, 3); assertCode(() -> resets.inspect(token), "RESET_LINK_INVALID");
        resetRow(now.plusSeconds(10), null, now, 3); assertCode(() -> resets.inspect(token), "RESET_LINK_INVALID");
        resetRow(now.plusSeconds(10), null, null, 2); assertCode(() -> resets.inspect(token), "RESET_LINK_INVALID");
        assertCode(() -> resets.inspect("invalid"), "RESET_LINK_INVALID");
        resetRow(now.plusSeconds(10), null, null, 3);
        when(store.account(2)).thenReturn(Optional.of(new TeamStore.AccountInfo(2, "test-coach", "hash", false, false, 3)));
        assertCode(() -> resets.inspect(token), "RESET_LINK_INVALID");
    }
    @Test void completionEnforcesPasswordPolicyAndNeverExposesSecretsInDtos() throws Exception {
        resetRow(now.plusSeconds(10), null, null, 3);
        assertCode(() -> resets.complete(token, "short"), "INVALID_NEW_PASSWORD");
        assertCode(() -> resets.complete(token, "test-original-password"), "PASSWORD_UNCHANGED");
        resets.complete(token, "test-next-password");
        var hash = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc).update(startsWith("UPDATE accounts SET password_hash"), hash.capture(), eq(2L));
        assertThat(encoder.matches("test-next-password", hash.getValue())).isTrue();
        verify(jdbc).update("UPDATE account_password_resets SET used_at=? WHERE id=?", Timestamp.from(now), 10L);
        assertThat(new PasswordResetDtos.CompleteInput(token, "secret").toString()).doesNotContain(token, "secret");
        assertThat(new PasswordResetDtos.TokenInput(token).toString()).doesNotContain(token);
    }
    private static void assertCode(Runnable action, String code) {
        assertThatThrownBy(action::run).isInstanceOf(TeamAccessException.class).extracting(e -> ((TeamAccessException)e).code()).isEqualTo(code);
    }
}
