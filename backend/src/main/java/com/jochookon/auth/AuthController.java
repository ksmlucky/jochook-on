package com.jochookon.auth;

import com.jochookon.team.TeamDtos;
import com.jochookon.team.TeamSessionService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final TeamSessionService sessions;
    public AuthController(TeamSessionService sessions) { this.sessions = sessions; }
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
