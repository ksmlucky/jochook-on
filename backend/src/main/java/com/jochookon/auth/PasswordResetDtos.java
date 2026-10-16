package com.jochookon.auth;

import java.time.Instant;
import java.util.List;

public final class PasswordResetDtos {
    private PasswordResetDtos() { }
    public record Team(long teamId, String teamName, String role) { }
    public record RecoveryAccount(long id, String username, List<Team> teams) { }
    public record IssueInput(Boolean identityVerified) { }
    public record Issued(String token, Instant expiresAt, String username) {
        @Override public String toString() { return "Issued[REDACTED]"; }
    }
    public record TokenInput(String token) {
        @Override public String toString() { return "TokenInput[REDACTED]"; }
    }
    public record CompleteInput(String token, String newPassword) {
        @Override public String toString() { return "CompleteInput[REDACTED]"; }
    }
    public record Inspected(String username, Instant expiresAt) { }
}
