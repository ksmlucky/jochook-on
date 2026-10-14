package com.jochookon.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class AdminBootstrapTest {
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);

    @Test
    void firstAccountIsAdminWithHashedPassword() {
        new AdminBootstrap(accounts, encoder, "test-admin", "test-only-password").run(null);
        var captured = ArgumentCaptor.forClass(Account.class);
        verify(accounts).save(captured.capture());
        Account saved = captured.getValue();
        assertThat(saved.getRole()).isEqualTo(AccountRole.ADMIN);
        assertThat(saved.getPasswordHash()).isNotEqualTo("test-only-password");
        assertThat(encoder.matches("test-only-password", saved.getPasswordHash())).isTrue();
    }

    @Test
    void neverOverwritesExistingAccounts() {
        when(accounts.count()).thenReturn(1L);
        new AdminBootstrap(accounts, encoder, "test-admin", "a-different-password").run(null);
        verify(accounts, never()).save(any());
    }

    @Test
    void noSettingsCreatesNoDefaultAccount() {
        new AdminBootstrap(accounts, encoder, "", "").run(null);
        verifyNoInteractions(accounts);
    }

    @Test
    void refusesWeakBootstrapPassword() {
        assertThatThrownBy(() -> new AdminBootstrap(accounts, encoder, "test-admin", "short").run(null))
                .isInstanceOf(IllegalArgumentException.class);
        verify(accounts, never()).save(any());
    }
}
