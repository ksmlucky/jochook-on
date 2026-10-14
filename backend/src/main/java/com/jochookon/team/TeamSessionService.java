package com.jochookon.team;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.Serializable;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Service;

@Service
public class TeamSessionService {
    static final String SESSION_KEY = TeamSessionService.class.getName() + ".session";
    public static final String REQUEST_KEY = TeamSessionService.class.getName() + ".access";
    private final TeamStore store;
    public TeamSessionService(TeamStore store) { this.store = store; }

    record SessionState(String authType, Long accountId, Long teamId, long codeVersion, Instant createdAt) implements Serializable { }
    public record Access(TeamDtos.CurrentUser user, Long accountId) {
        public List<SimpleGrantedAuthority> authorities() {
            return user.serviceAdmin()
                    ? List.of(new SimpleGrantedAuthority("ROLE_" + user.role()), new SimpleGrantedAuthority("ROLE_SERVICE_ADMIN"))
                    : List.of(new SimpleGrantedAuthority("ROLE_" + user.role()));
        }
    }

    public Access inspect(Authentication authentication, HttpServletRequest request) {
        if (authentication == null || !authentication.isAuthenticated() || authentication instanceof AnonymousAuthenticationToken) return null;
        HttpSession session = request.getSession(false);
        SessionState state = session == null ? null : (SessionState) session.getAttribute(SESSION_KEY);
        if (state != null && state.authType().equals("TEAM_CODE")) return codeAccess(state, session);
        TeamStore.AccountInfo account = store.account(authentication.getName()).filter(TeamStore.AccountInfo::enabled)
                .orElseThrow(() -> expired("로그인이 만료되었습니다. 다시 로그인해 주세요."));
        List<TeamDtos.MyTeam> teams = store.memberships(account.id());
        if (state == null || state.accountId() == null || state.accountId() != account.id()) {
            state = new SessionState("ACCOUNT", account.id(), teams.size() == 1 ? teams.getFirst().id() : null, 0, Instant.now());
        }
        TeamDtos.MyTeam selected = selected(teams, state.teamId());
        if (state.teamId() != null && selected == null) state = new SessionState("ACCOUNT", account.id(), null, 0, state.createdAt());
        session = request.getSession(true);
        session.setMaxInactiveInterval(30 * 60);
        session.setAttribute(SESSION_KEY, state);
        return new Access(new TeamDtos.CurrentUser(account.username(), selected == null ? "MEMBER" : selected.role(), "ACCOUNT", account.serviceAdmin(),
                selected == null ? null : selected.team(), teams), account.id());
    }

    private Access codeAccess(SessionState state, HttpSession session) {
        Instant now = Instant.now();
        if (state.teamId() == null || !now.isBefore(state.createdAt().plus(Duration.ofDays(7)))) throw expiredCode();
        TeamStore.CodeInfo code = store.code(state.teamId()).orElseThrow(TeamSessionService::expiredCode);
        TeamDtos.Team team = store.team(state.teamId()).filter(t -> t.status().equals("ACTIVE")).orElseThrow(TeamSessionService::expiredCode);
        if (code.version() != state.codeVersion() || !TeamCodeService.status(code, now).equals("ACTIVE")) throw expiredCode();
        session.setMaxInactiveInterval(24 * 60 * 60);
        return new Access(new TeamDtos.CurrentUser(null, "MEMBER", "TEAM_CODE", false, team, List.of()), null);
    }

    public Access current(HttpServletRequest request) {
        Object access = request.getAttribute(REQUEST_KEY);
        if (!(access instanceof Access result)) throw expired("로그인이 필요합니다.");
        return result;
    }
    public long requireAccount(HttpServletRequest request) {
        Access access = current(request);
        if (access.accountId() == null) throw new TeamAccessException(403, "ACCOUNT_REQUIRED", "운영진 계정으로 로그인해 주세요.");
        return access.accountId();
    }
    public long requireServiceAdmin(HttpServletRequest request) {
        Access access = current(request);
        if (access.accountId() == null || !access.user().serviceAdmin()) throw new TeamAccessException(403, "FORBIDDEN", "이 작업에 접근할 수 없습니다.");
        return access.accountId();
    }
    public long requireTeamAdmin(HttpServletRequest request) {
        Access access = current(request);
        if (access.accountId() == null || !TeamRoles.canWrite(access.user().role()) || access.user().team() == null)
            throw new TeamAccessException(403, "FORBIDDEN", "이 작업에 접근할 수 없습니다.");
        return access.accountId();
    }
    public long requireDirector(HttpServletRequest request) {
        Access access = current(request);
        if (access.accountId() == null || !access.user().role().equals("DIRECTOR") || access.user().team() == null)
            throw new TeamAccessException(403, "FORBIDDEN", "감독만 코치 권한을 관리할 수 있습니다.");
        return access.accountId();
    }
    public TeamDtos.CurrentUser select(long teamId, HttpServletRequest request) {
        long accountId = requireAccount(request);
        TeamStore.AccountInfo account = store.account(accountId).filter(TeamStore.AccountInfo::enabled)
                .orElseThrow(() -> expired("로그인이 필요합니다."));
        var teams = store.memberships(accountId);
        TeamDtos.MyTeam team = selected(teams, teamId);
        if (team == null) throw new TeamAccessException(403, "TEAM_FORBIDDEN", "이 팀에 접근할 수 없습니다.");
        request.getSession().setAttribute(SESSION_KEY, new SessionState("ACCOUNT", accountId, teamId, 0, Instant.now()));
        return new TeamDtos.CurrentUser(account.username(), team.role(), "ACCOUNT", account.serviceAdmin(), team.team(), teams);
    }
    public TeamDtos.CurrentUser beginAccount(String username, Long selectedTeamId, HttpServletRequest request, HttpServletResponse response) {
        TeamStore.AccountInfo account = store.account(username).filter(TeamStore.AccountInfo::enabled)
                .orElseThrow(() -> expired("계정을 확인할 수 없습니다."));
        var teams = store.memberships(account.id());
        TeamDtos.MyTeam selected = selected(teams, selectedTeamId);
        if (selected == null && teams.size() == 1) selected = teams.getFirst();
        var user = new TeamDtos.CurrentUser(account.username(), selected == null ? "MEMBER" : selected.role(), "ACCOUNT", account.serviceAdmin(),
                selected == null ? null : selected.team(), teams);
        replace(new SessionState("ACCOUNT", account.id(), selected == null ? null : selected.id(), 0, Instant.now()),
                new Access(user, account.id()), username, request, response, 30 * 60);
        return user;
    }
    public TeamDtos.CurrentUser beginCode(TeamStore.CodeInfo code, TeamDtos.Team team, HttpServletRequest request, HttpServletResponse response) {
        if (code.teamId() != team.id() || !team.status().equals("ACTIVE") || !TeamCodeService.status(code, Instant.now()).equals("ACTIVE"))
            throw expiredCode();
        var user = new TeamDtos.CurrentUser(null, "MEMBER", "TEAM_CODE", false, team, List.of());
        replace(new SessionState("TEAM_CODE", null, team.id(), code.version(), Instant.now()), new Access(user, null),
                "team-code:" + team.id(), request, response, 24 * 60 * 60);
        return user;
    }
    private void replace(SessionState state, Access access, String principal, HttpServletRequest request, HttpServletResponse response, int idleSeconds) {
        HttpSession previous = request.getSession(false);
        if (previous != null) previous.invalidate();
        HttpSession session = request.getSession(true);
        session.setMaxInactiveInterval(idleSeconds);
        session.setAttribute(SESSION_KEY, state);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(principal, null, access.authorities()));
        SecurityContextHolder.setContext(context);
        new HttpSessionSecurityContextRepository().saveContext(context, request, response);
        request.setAttribute(REQUEST_KEY, access);
    }
    private static TeamDtos.MyTeam selected(List<TeamDtos.MyTeam> teams, Long id) {
        return id == null ? null : teams.stream().filter(t -> t.id() == id).findFirst().orElse(null);
    }
    static TeamAccessException expiredCode() { return new TeamAccessException(401, "CODE_SESSION_EXPIRED", "팀 접속이 종료되었습니다. 운영진에게 최신 팀 코드와 팀 비밀번호를 받아 다시 입력해 주세요."); }
    static TeamAccessException expired(String message) { return new TeamAccessException(401, "SESSION_EXPIRED", message); }
}
