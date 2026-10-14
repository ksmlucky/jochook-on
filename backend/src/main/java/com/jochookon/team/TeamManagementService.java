package com.jochookon.team;

import java.nio.charset.StandardCharsets;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class TeamManagementService {
    private final TeamStore store;
    private final PasswordEncoder passwords;
    public TeamManagementService(TeamStore store, PasswordEncoder passwords) { this.store = store; this.passwords = passwords; }

    public List<TeamDtos.Team> teams(long actor) {
        serviceAdmin(actor);
        return store.jdbc().query("SELECT * FROM teams ORDER BY id", TeamStore::team);
    }
    public TeamDtos.TeamDetail detail(long actor, long teamId) {
        serviceAdmin(actor);
        return detail(teamId, false);
    }
    private TeamDtos.TeamDetail detail(long teamId, boolean coachOnly) {
        TeamDtos.Team team = team(teamId);
        var members = store.jdbc().query("SELECT m.id, a.username, m.role, m.active FROM team_memberships m JOIN accounts a ON a.id = m.account_id WHERE m.team_id = ? ORDER BY m.id",
                (r, n) -> new TeamDtos.Member(r.getLong("id"), r.getString("username"), r.getString("role"), r.getBoolean("active")), teamId);
        var invites = store.jdbc().query("SELECT * FROM team_invites WHERE team_id = ?" + (coachOnly ? " AND role = 'COACH'" : "") + " ORDER BY id DESC", TeamStore::invite, teamId)
                .stream().map(TeamManagementService::inviteDto).toList();
        return new TeamDtos.TeamDetail(team, members, invites);
    }
    @Transactional
    public TeamDtos.TeamCreated create(long actor, TeamDtos.CreateTeam request) {
        serviceAdmin(actor);
        String requestId;
        try { requestId = UUID.fromString(request.requestId()).toString(); }
        catch (RuntimeException exception) { throw invalid("생성 요청을 새로 시작해 주세요."); }
        String name = text(request.name(), 2, 40, "팀명"), description = text(request.description(), 0, 40, "구분 설명");
        boolean existing = "EXISTING".equals(request.assignmentType());
        if (!existing && !"INVITE".equals(request.assignmentType())) throw invalid("운영진 지정 방식을 선택해 주세요.");
        String target = existing ? username(request.username()) : text(request.inviteLabel(), 1, 60, "지정 대상 표시명");
        String fingerprint = AccessTokens.hash(part(name) + part(description) + part(request.assignmentType()) + part(target));
        // The unique request row serializes retries, including retries while the first transaction is still committing.
        try {
            store.jdbc().update("INSERT INTO team_creation_requests (account_id, request_id, request_hash) VALUES (?, ?, ?)", actor, requestId, fingerprint);
        } catch (DuplicateKeyException duplicate) {
            var previous = store.jdbc().queryForMap("SELECT request_hash, team_id FROM team_creation_requests WHERE account_id = ? AND request_id = ? FOR UPDATE", actor, requestId);
            if (!fingerprint.equals(previous.get("request_hash"))) throw new TeamAccessException(409, "REQUEST_CHANGED", "같은 생성 요청의 내용이 달라졌습니다. 목록을 확인해 주세요.");
            long id = ((Number) previous.get("team_id")).longValue();
            return new TeamDtos.TeamCreated(lockTeam(id), null, true);
        }
        Long accountId = existing ? enabledAccount(target).id() : null;
        long teamId = insert("INSERT INTO teams (name, description, status) VALUES (?, ?, ?)", name, description, existing ? "ACTIVE" : "PENDING");
        store.jdbc().update("INSERT INTO team_codes (team_id) VALUES (?)", teamId);
        TeamDtos.InviteIssued invitation = null;
        if (existing) grant(teamId, accountId, "DIRECTOR", false);
        else invitation = issueInvite(actor, teamId, target, "DIRECTOR");
        store.jdbc().update("UPDATE team_creation_requests SET team_id = ?, invite_id = ? WHERE account_id = ? AND request_id = ?",
                teamId, invitation == null ? null : invitation.id(), actor, requestId);
        return new TeamDtos.TeamCreated(team(teamId), invitation, false);
    }
    @Transactional
    public TeamDtos.TeamDetail addMember(long actor, long teamId, String username) {
        return addMember(actor, teamId, username, null);
    }
    @Transactional
    public TeamDtos.TeamDetail addMember(long actor, long teamId, String username, String role) {
        serviceAdmin(actor); lockTeam(teamId);
        grant(teamId, enabledAccount(username(username)).id(), TeamRoles.assignment(role), false);
        return detail(actor, teamId);
    }
    @Transactional
    public void removeMember(long actor, long teamId, long membershipId) {
        serviceAdmin(actor); lockTeam(teamId);
        var found = store.jdbc().queryForList("SELECT role, active FROM team_memberships WHERE id = ? AND team_id = ? FOR UPDATE", membershipId, teamId);
        if (found.isEmpty()) throw missing();
        var member = found.getFirst();
        if ("DIRECTOR".equals(member.get("role")) && Boolean.TRUE.equals(member.get("active"))) protectLastDirector(teamId);
        store.jdbc().update("UPDATE team_memberships SET active = 0 WHERE id = ? AND team_id = ?", membershipId, teamId);
    }
    @Transactional
    public TeamDtos.InviteIssued invite(long actor, long teamId, String label) {
        return invite(actor, teamId, label, null);
    }
    @Transactional
    public TeamDtos.InviteIssued invite(long actor, long teamId, String label, String role) {
        serviceAdmin(actor); lockTeam(teamId);
        return issueInvite(actor, teamId, text(label, 1, 60, "지정 대상 표시명"), TeamRoles.assignment(role));
    }
    @Transactional
    public TeamDtos.InviteIssued reissue(long actor, long teamId, long inviteId) {
        serviceAdmin(actor); lockTeam(teamId);
        TeamStore.InviteInfo previous = lockedInvite(teamId, inviteId);
        return reissue(actor, previous);
    }
    private TeamDtos.InviteIssued reissue(long actor, TeamStore.InviteInfo previous) {
        if (previous.usedAt() != null) throw new TeamAccessException(409, "INVITE_USED", "이미 활성화된 초대입니다. 운영진 지정 상태를 확인해 주세요.");
        String token = AccessTokens.invite();
        Instant expires = Instant.now().plus(Duration.ofHours(24));
        store.jdbc().update("UPDATE team_invites SET token_hash = ?, version = version + 1, expires_at = ?, cancelled_at = NULL, created_by = ? WHERE id = ?",
                AccessTokens.hash(token), Timestamp.from(expires), actor, previous.id());
        return new TeamDtos.InviteIssued(previous.id(), previous.label(), "PENDING", expires, token, previous.role());
    }
    @Transactional
    public void cancel(long actor, long teamId, long inviteId) {
        serviceAdmin(actor); lockTeam(teamId);
        TeamStore.InviteInfo previous = lockedInvite(teamId, inviteId);
        cancel(previous);
    }
    private void cancel(TeamStore.InviteInfo previous) {
        if (previous.usedAt() != null) throw new TeamAccessException(409, "INVITE_USED", "이미 활성화된 초대입니다. 운영진 지정 상태를 확인해 주세요.");
        store.jdbc().update("UPDATE team_invites SET cancelled_at = ?, version = version + 1 WHERE id = ?", Timestamp.from(Instant.now()), previous.id());
    }
    public TeamDtos.TeamDetail coaches(long actor, long teamId) {
        requireDirector(actor, teamId, false);
        return detail(teamId, true);
    }
    @Transactional
    public TeamDtos.TeamDetail addCoach(long actor, long teamId, String username) {
        requireDirector(actor, teamId, true);
        var target = enabledAccount(username(username));
        var existing = store.jdbc().queryForList("SELECT role FROM team_memberships WHERE team_id=? AND account_id=? FOR UPDATE", String.class, teamId, target.id());
        if (target.id() == actor || existing.contains("DIRECTOR")) throw protectedMember();
        grant(teamId, target.id(), "COACH", true);
        return detail(teamId, true);
    }
    @Transactional
    public void removeCoach(long actor, long teamId, long membershipId) {
        requireDirector(actor, teamId, true);
        var target = store.jdbc().queryForList("SELECT account_id,role FROM team_memberships WHERE team_id=? AND id=? FOR UPDATE", teamId, membershipId);
        if (target.isEmpty()) throw missing();
        if (((Number) target.getFirst().get("account_id")).longValue() == actor || !"COACH".equals(target.getFirst().get("role"))) throw protectedMember();
        store.jdbc().update("UPDATE team_memberships SET role='MEMBER' WHERE team_id=? AND id=?", teamId, membershipId);
    }
    @Transactional
    public TeamDtos.InviteIssued inviteCoach(long actor, long teamId, String label) {
        requireDirector(actor, teamId, true);
        return issueInvite(actor, teamId, text(label, 1, 60, "지정 대상 표시명"), "COACH");
    }
    @Transactional
    public TeamDtos.InviteIssued reissueCoach(long actor, long teamId, long inviteId) {
        requireDirector(actor, teamId, true);
        return reissue(actor, coachInvite(teamId, inviteId));
    }
    @Transactional
    public void cancelCoach(long actor, long teamId, long inviteId) {
        requireDirector(actor, teamId, true);
        cancel(coachInvite(teamId, inviteId));
    }
    private TeamStore.InviteInfo coachInvite(long teamId, long inviteId) {
        var invite = lockedInvite(teamId, inviteId);
        if (!invite.role().equals("COACH")) throw protectedMember();
        return invite;
    }
    private void requireDirector(long actor, long teamId, boolean lock) {
        var team = lock ? lockTeam(teamId) : team(teamId);
        if (!team.status().equals("ACTIVE")) throw new TeamAccessException(403, "TEAM_FORBIDDEN", "이 팀에 접근할 수 없습니다.");
        store.requireActiveRole(actor, teamId, lock, "DIRECTOR");
    }
    private void protectLastDirector(long teamId) {
        // Current reads preserve the invariant even if this transaction opened an older RR snapshot.
        var directors = store.jdbc().queryForList("SELECT m.id FROM team_memberships m JOIN accounts a ON a.id=m.account_id WHERE m.team_id=? AND m.role='DIRECTOR' AND m.active=1 AND a.enabled=1 ORDER BY m.id FOR UPDATE", Long.class, teamId);
        if (directors.size() <= 1) throw new TeamAccessException(409, "LAST_DIRECTOR", "다른 감독이 활성화된 뒤 감독 권한을 해제할 수 있습니다.");
    }
    private void requireCurrentIssuer(TeamStore.InviteInfo invite, boolean lock) {
        var creators = store.jdbc().query("SELECT * FROM accounts WHERE id=?" + (lock ? " FOR UPDATE" : ""), TeamStore::account, invite.createdBy());
        if (creators.isEmpty() || !creators.getFirst().enabled()) throw invalidInvite();
        if (creators.getFirst().serviceAdmin()) return;
        if (!invite.role().equals("COACH")) throw invalidInvite();
        try { store.requireActiveRole(invite.createdBy(), invite.teamId(), lock, "DIRECTOR"); }
        catch (TeamAccessException exception) { throw invalidInvite(); }
    }
    public TeamDtos.InvitationInfo inspect(String token) {
        TeamStore.InviteInfo invite = usableInvite(token, false);
        return new TeamDtos.InvitationInfo(team(invite.teamId()), invite.label(), invite.expiresAt(), invite.role());
    }
    public record Accepted(String username, long teamId) { }
    @Transactional
    public Accepted accept(TeamDtos.InvitationAccept request, Long accountId) {
        TeamStore.InviteInfo preview = usableInvite(request.token(), false);
        lockTeam(preview.teamId());
        TeamStore.InviteInfo invite = usableInvite(request.token(), true);
        TeamStore.AccountInfo account;
        if (accountId != null) {
            account = store.account(accountId).filter(TeamStore.AccountInfo::enabled).orElseThrow(() -> TeamSessionService.expired("로그인이 필요합니다."));
        } else {
            String username = username(request.username());
            if (store.account(username).isPresent()) throw accountExists();
            validatePassword(request.password());
            long created;
            try { created = insert("INSERT INTO accounts (username, password_hash, role, enabled, service_admin) VALUES (?, ?, 'ADMIN', 1, 0)", username, passwords.encode(request.password())); }
            catch (DuplicateKeyException exception) { throw accountExists(); }
            account = store.account(created).orElseThrow(TeamManagementService::missing);
        }
        grant(invite.teamId(), account.id(), invite.role(), true);
        store.jdbc().update("UPDATE team_invites SET used_at = ?, version = version + 1 WHERE id = ?", Timestamp.from(Instant.now()), invite.id());
        return new Accepted(account.username(), invite.teamId());
    }
    private TeamDtos.InviteIssued issueInvite(long actor, long teamId, String label, String role) {
        String token = AccessTokens.invite();
        Instant expires = Instant.now().plus(Duration.ofHours(24));
        long id = insert("INSERT INTO team_invites (team_id, display_name, token_hash, expires_at, created_by, role) VALUES (?, ?, ?, ?, ?, ?)",
                teamId, label, AccessTokens.hash(token), Timestamp.from(expires), actor, role);
        return new TeamDtos.InviteIssued(id, label, "PENDING", expires, token, role);
    }
    private void grant(long teamId, long accountId, String role, boolean preserveDirector) {
        var previous = store.jdbc().queryForList("SELECT role, active FROM team_memberships WHERE team_id=? AND account_id=? FOR UPDATE", teamId, accountId);
        if (!previous.isEmpty() && "DIRECTOR".equals(previous.getFirst().get("role")) && Boolean.TRUE.equals(previous.getFirst().get("active")) && !role.equals("DIRECTOR")) {
            if (preserveDirector) role = "DIRECTOR";
            else protectLastDirector(teamId);
        }
        store.jdbc().update("INSERT INTO team_memberships (team_id, account_id, role, active) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE role = ?, active = 1", teamId, accountId, role, role);
        store.jdbc().update("UPDATE teams SET status = 'ACTIVE', version = version + 1 WHERE id = ? AND status = 'PENDING'", teamId);
    }
    private TeamStore.InviteInfo usableInvite(String token, boolean lock) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) throw invalidInvite();
        var invite = store.inviteByHash(AccessTokens.hash(token), lock).orElseThrow(TeamManagementService::invalidInvite);
        if (!inviteDto(invite).status().equals("PENDING")) throw invalidInvite();
        if (store.team(invite.teamId()).filter(t -> !t.status().equals("INACTIVE")).isEmpty()) throw invalidInvite();
        requireCurrentIssuer(invite, lock);
        return invite;
    }
    private TeamStore.InviteInfo lockedInvite(long teamId, long inviteId) {
        return store.jdbc().query("SELECT * FROM team_invites WHERE id = ? AND team_id = ? FOR UPDATE", TeamStore::invite, inviteId, teamId)
                .stream().findFirst().orElseThrow(TeamManagementService::missing);
    }
    private TeamDtos.Team lockTeam(long teamId) {
        var teams = store.jdbc().query("SELECT * FROM teams WHERE id = ? FOR UPDATE", TeamStore::team, teamId);
        if (teams.isEmpty()) throw missing();
        if (teams.getFirst().status().equals("INACTIVE")) throw new TeamAccessException(403, "TEAM_FORBIDDEN", "이 팀에 접근할 수 없습니다.");
        return teams.getFirst();
    }
    private TeamDtos.Team team(long id) { return store.team(id).orElseThrow(TeamManagementService::missing); }
    private TeamStore.AccountInfo enabledAccount(String username) {
        return store.account(username).filter(TeamStore.AccountInfo::enabled).orElseThrow(() -> invalid("지정할 계정을 확인해 주세요."));
    }
    private void serviceAdmin(long actor) {
        if (store.account(actor).filter(a -> a.enabled() && a.serviceAdmin()).isEmpty()) throw new TeamAccessException(403, "FORBIDDEN", "이 작업에 접근할 수 없습니다.");
    }
    private long insert(String sql, Object... values) {
        var holder = new GeneratedKeyHolder();
        store.jdbc().update(connection -> {
            var statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < values.length; i++) statement.setObject(i + 1, values[i]);
            return statement;
        }, holder);
        return holder.getKey().longValue();
    }
    private static TeamDtos.Invite inviteDto(TeamStore.InviteInfo invite) {
        String status = invite.usedAt() != null ? "ACCEPTED" : invite.cancelledAt() != null ? "REVOKED" : Instant.now().isBefore(invite.expiresAt()) ? "PENDING" : "EXPIRED";
        return new TeamDtos.Invite(invite.id(), invite.label(), status, invite.expiresAt(), invite.role());
    }
    static String username(String input) {
        String username = input == null ? "" : input.strip().toLowerCase(Locale.ROOT);
        if (!username.matches("[a-z][a-z0-9_.-]{2,39}")) throw invalid("아이디는 영문 소문자로 시작하는 3~40자여야 합니다.");
        return username;
    }
    static void validatePassword(String password) {
        if (password == null || password.length() < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw invalid("비밀번호는 12자 이상, UTF-8 72바이트 이하로 입력해 주세요.");
    }
    private static String text(String value, int min, int max, String label) {
        String normalized = value == null ? "" : value.strip();
        if (normalized.length() < min || normalized.length() > max) throw invalid(label + " 입력 길이를 확인해 주세요.");
        return normalized;
    }
    private static String part(String input) { return input.length() + ":" + input; }
    private static TeamAccessException invalid(String message) { return new TeamAccessException(400, "VALIDATION_ERROR", message); }
    private static TeamAccessException missing() { return new TeamAccessException(404, "NOT_FOUND", "요청한 정보를 확인할 수 없습니다."); }
    private static TeamAccessException protectedMember() { return new TeamAccessException(409, "PROTECTED_MEMBER", "코치 권한만 변경할 수 있습니다. 감독 또는 본인 권한은 변경할 수 없습니다."); }
    private static TeamAccessException invalidInvite() { return new TeamAccessException(401, "INVALID_INVITATION", "초대 링크를 사용할 수 없습니다. 서비스 관리자에게 새 초대를 요청해 주세요."); }
    private static TeamAccessException accountExists() { return new TeamAccessException(409, "ACCOUNT_EXISTS", "기존 계정으로 로그인한 뒤 초대를 수락해 주세요."); }
}
