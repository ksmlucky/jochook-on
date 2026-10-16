package com.jochookon.auth;

import com.jochookon.team.TeamDtos;
import com.jochookon.team.TeamSessionService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final TeamSessionService sessions;
    private final PasswordChangeService passwords;
    public AuthController(TeamSessionService sessions, PasswordChangeService passwords) {
        this.sessions = sessions; this.passwords = passwords;
    }
    @PostMapping("/password/change")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void changePassword(@RequestBody PasswordChangeInput input, HttpServletRequest request) {
        long accountId = sessions.requireAccount(request);
        passwords.change(accountId, sessions.credentialVersion(request), input.currentPassword(), input.newPassword());
        if (request.getSession(false) != null) request.getSession(false).invalidate();
        SecurityContextHolder.clearContext();
        request.removeAttribute(TeamSessionService.REQUEST_KEY);
    }
    record PasswordChangeInput(String currentPassword, String newPassword) {
        @Override public String toString() { return "PasswordChangeInput[REDACTED]"; }
    }
    @GetMapping("/csrf")
    CsrfResponse csrf(CsrfToken token) {
        return new CsrfResponse(token.getHeaderName(), token.getToken());
    }

    @GetMapping("/me")
    TeamDtos.CurrentUser me(HttpServletRequest request) {
        return sessions.current(request).user();
    }

    record CsrfResponse(String headerName, String token) { }
}
