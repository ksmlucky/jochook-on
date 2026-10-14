package com.jochookon.team;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import java.util.Set;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

public class TeamAccessFilter extends OncePerRequestFilter {
    private static final Set<String> PUBLIC_POSTS = Set.of("/api/v1/auth/login", "/api/v1/auth/team-code",
            "/api/v1/auth/invitation/inspect", "/api/v1/auth/invitation/accept");
    private final TeamSessionService sessions;
    private final AccessRateLimiter limiter;
    private final ObjectMapper json;
    public TeamAccessFilter(TeamSessionService sessions, AccessRateLimiter limiter, ObjectMapper json) {
        this.sessions = sessions; this.limiter = limiter; this.json = json;
    }
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        TeamContext.clear();
        String path = request.getServletPath().isEmpty() ? request.getRequestURI() : request.getServletPath();
        boolean limited = request.getMethod().equals("POST") && PUBLIC_POSTS.contains(path);
        try {
            if (limited) {
                long retry = limiter.retryAfter(request);
                if (retry > 0) {
                    response.setHeader("Retry-After", String.valueOf(retry));
                    write(response, 429, Map.of("code", "RATE_LIMITED", "message", "잠시 후 다시 시도해 주세요.", "retryAfterSeconds", retry));
                    return;
                }
            }
            // Expired access must not prevent a new login or obtaining a fresh CSRF token.
            if (!path.equals("/actuator/health") && !path.equals("/api/v1/auth/csrf") && !path.equals("/api/v1/auth/logout") && !path.equals("/error")) {
                TeamSessionService.Access access;
                try {
                    access = sessions.inspect(SecurityContextHolder.getContext().getAuthentication(), request);
                } catch (TeamAccessException exception) {
                    if (request.getSession(false) != null) request.getSession(false).invalidate();
                    SecurityContextHolder.clearContext();
                    if (!limited) throw exception;
                    access = null;
                }
                if (access != null) {
                    request.setAttribute(TeamSessionService.REQUEST_KEY, access);
                    var existing = SecurityContextHolder.getContext().getAuthentication();
                    var context = SecurityContextHolder.createEmptyContext();
                    context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(existing.getPrincipal(), null, access.authorities()));
                    SecurityContextHolder.setContext(context);
                }
                if (scoped(path)) {
                    if (access == null) throw new TeamAccessException(401, "SESSION_EXPIRED", "접속이 만료되었습니다. 다시 접속해 주세요.");
                    if (access.user().team() == null) throw new TeamAccessException(403, "TEAM_REQUIRED", "접속할 팀을 선택해 주세요.");
                    String expected = request.getHeader("X-Team-Id");
                    if (expected == null || !expected.equals(String.valueOf(access.user().team().id())))
                        throw new TeamAccessException(409, "TEAM_CHANGED", "접속한 팀이 변경되었습니다. 현재 팀을 다시 확인해 주세요.");
                    TeamContext.set(access.user().team().id());
                }
            }
            chain.doFilter(request, response);
            if (limited && response.getStatus() >= 400 && response.getStatus() < 500 && response.getStatus() != 429) limiter.failed(request);
        } catch (TeamAccessException exception) {
            if (limited) limiter.failed(request);
            write(response, exception.status(), Map.of("code", exception.code(), "message", exception.getMessage()));
        } finally { TeamContext.clear(); }
    }
    private static boolean scoped(String path) {
        return path.equals("/api/v1/players") || path.startsWith("/api/v1/players/")
                || path.equals("/api/v1/matches") || path.startsWith("/api/v1/matches/") || path.startsWith("/api/v1/team/");
    }
    private void write(HttpServletResponse response, int status, Object body) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(json.writeValueAsString(body));
    }
}
