package com.jochookon.team;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** MVC slices mock session storage only; the production security rules and header filter still run. */
public abstract class TeamMvcTestSupport {
    @MockitoBean protected TeamSessionService teamSessions;
    @MockitoBean protected AccessRateLimiter accessLimiter;

    @BeforeEach
    void scopedTestSession() {
        when(teamSessions.inspect(nullable(Authentication.class), any(HttpServletRequest.class))).thenAnswer(call -> {
            Authentication auth = call.getArgument(0);
            if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) return null;
            String role = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_DIRECTOR")) ? "DIRECTOR"
                    : auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_COACH")) ? "COACH" : "MEMBER";
            boolean service = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_SERVICE_ADMIN"));
            var team = new TeamDtos.Team(1L, "Test club", "", "ACTIVE");
            return new TeamSessionService.Access(new TeamDtos.CurrentUser(auth.getName(), role, "ACCOUNT", service, team,
                    List.of(new TeamDtos.MyTeam(1L, team.name(), "", "ACTIVE", role))), 1L);
        });
        when(teamSessions.current(any(HttpServletRequest.class))).thenAnswer(call -> ((HttpServletRequest) call.getArgument(0)).getAttribute(TeamSessionService.REQUEST_KEY));
    }
}
