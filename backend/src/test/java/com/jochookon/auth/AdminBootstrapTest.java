package com.jochookon.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.jochookon.team.TeamStore;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class AdminBootstrapTest {
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final TeamStore teams = mock(TeamStore.class);
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);

    @Test
    void firstAccountIsAdminWithHashedPassword() {
        Account persisted = mock(Account.class);
        when(persisted.getId()).thenReturn(7L);
        when(accounts.saveAndFlush(any())).thenReturn(persisted);
        new AdminBootstrap(accounts, encoder, teams, "test-admin", "test-only-password", "").run(null);
        var captured = ArgumentCaptor.forClass(Account.class);
        verify(accounts).saveAndFlush(captured.capture());
        Account saved = captured.getValue();
        assertThat(saved.getRole()).isEqualTo(AccountRole.ADMIN);
        assertThat(saved.isServiceAdmin()).isFalse();
        assertThat(saved.getPasswordHash()).isNotEqualTo("test-only-password");
        assertThat(encoder.matches("test-only-password", saved.getPasswordHash())).isTrue();
        verify(teams).bootstrapMembership(7L);
    }

    @Test
    void neverOverwritesExistingAccounts() {
        when(accounts.count()).thenReturn(1L);
        new AdminBootstrap(accounts, encoder, teams, "test-admin", "a-different-password", "").run(null);
        verify(accounts, never()).saveAndFlush(any());
        verifyNoInteractions(teams);
    }

    @Test
    void noSettingsCreatesNoDefaultAccount() {
        new AdminBootstrap(accounts, encoder, teams, "", "", "").run(null);
        verifyNoInteractions(accounts, teams);
    }

    @Test
    void refusesWeakBootstrapPassword() {
        assertThatThrownBy(() -> new AdminBootstrap(accounts, encoder, teams, "test-admin", "short", "").run(null))
                .isInstanceOf(IllegalArgumentException.class);
        verify(accounts, never()).saveAndFlush(any());
    }

    @Test
    void onlyExplicitNamedAccountGetsServiceAdministration() {
        Account selected = Account.create("test-owner", encoder.encode("test-only-password"), AccountRole.ADMIN);
        when(accounts.findByUsername("test-owner")).thenReturn(Optional.of(selected));
        new AdminBootstrap(accounts, encoder, teams, "", "", "test-owner").run(null);
        assertThat(selected.isServiceAdmin()).isTrue();
        verify(accounts, never()).saveAndFlush(any());
    }
}
