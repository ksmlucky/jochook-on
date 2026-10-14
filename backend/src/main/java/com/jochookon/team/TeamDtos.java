package com.jochookon.team;

import java.time.Instant;
import java.util.List;

public final class TeamDtos {
    private TeamDtos() { }
    public record Team(long id, String name, String description, String status) { }
    public record MyTeam(long id, String name, String description, String status, String role) {
        public Team team() { return new Team(id, name, description, status); }
    }
    public record CurrentUser(String username, String role, String authType, boolean serviceAdmin, Team team, List<MyTeam> teams) { }
    public record Member(long id, String username, String role, boolean active) { }
    public record Invite(long id, String label, String status, Instant expiresAt, String role) { }
    public record InviteIssued(long id, String label, String status, Instant expiresAt, String token, String role) { }
    public record TeamDetail(Team team, List<Member> members, List<Invite> invitations) { }
    public record CodeState(String status, long version, Instant issuedAt, Instant expiresAt) { }
    public record CodeIssued(String status, long version, Instant issuedAt, Instant expiresAt, String code, String password) {
        @Override public String toString() { return "CodeIssued[status=" + status + ", version=" + version + ", credentials=REDACTED]"; }
    }
    public record CodeHistoryEntry(long id, String action, String actorUsername, long version, Instant occurredAt, Instant expiresAt) { }
    public record TeamCreated(Team team, InviteIssued invitation, boolean replayed) { }
    public record InvitationInfo(Team team, String label, Instant expiresAt, String role) { }
    public record CreateTeam(String requestId, String name, String description, String assignmentType, String username, String inviteLabel) { }
    public record InvitationAccept(String token, String username, String password) { }
    public record Version(long version) { }
    public record CodeInput(String code, String password) {
        @Override public String toString() { return "CodeInput[credentials=REDACTED]"; }
    }
    public record TeamInput(long teamId) { }
    public record TokenInput(String token) { }
    public record UsernameInput(String username, String role) { }
    public record LabelInput(String label, String role) { }
}
