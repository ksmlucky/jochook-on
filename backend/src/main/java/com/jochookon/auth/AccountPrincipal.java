package com.jochookon.auth;

import java.util.List;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;

/** The version authenticated alongside the password, before a session is issued. */
public final class AccountPrincipal extends User {
    private final long credentialVersion;
    public AccountPrincipal(Account account) {
        super(account.getUsername(), account.getPasswordHash(), account.isEnabled(), true, true, true,
                List.of(new SimpleGrantedAuthority("ROLE_" + account.getRole().name())));
        credentialVersion = account.getCredentialVersion();
    }
    public long credentialVersion() { return credentialVersion; }
}
