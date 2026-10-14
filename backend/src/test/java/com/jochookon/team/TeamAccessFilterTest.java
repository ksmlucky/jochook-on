package com.jochookon.team;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import jakarta.servlet.FilterChain;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import tools.jackson.databind.json.JsonMapper;

class TeamAccessFilterTest {
    @AfterEach void clear() { SecurityContextHolder.clearContext(); TeamContext.clear(); }
    @Test void staleTabCannotWriteToNewSelectedTeamAndContextIsCleared() throws Exception {
        var sessions = mock(TeamSessionService.class);
        var access = new TeamSessionService.Access(new TeamDtos.CurrentUser("test-admin", "DIRECTOR", "ACCOUNT", false,
                new TeamDtos.Team(2, "Other club", "", "ACTIVE"), List.of()), 1L);
        when(sessions.inspect(any(), any())).thenReturn(access);
        SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated("test-admin", null, access.authorities()));
        var filter = new TeamAccessFilter(sessions, new AccessRateLimiter(), new JsonMapper());
        var request = new MockHttpServletRequest("POST", "/api/v1/matches"); request.addHeader("X-Team-Id", "1");
        var response = new MockHttpServletResponse(); var chain = mock(FilterChain.class);
        filter.doFilter(request, response, chain);
        assertThat(response.getStatus()).isEqualTo(409);
        assertThat(response.getContentAsString()).contains("TEAM_CHANGED");
        verifyNoInteractions(chain);
        assertThatThrownBy(TeamContext::requireTeamId).isInstanceOf(TeamAccessException.class);
    }
}
