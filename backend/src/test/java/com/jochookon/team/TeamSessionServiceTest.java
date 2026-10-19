package com.jochookon.team;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class TeamSessionServiceTest {
    private final TeamStore store = mock(TeamStore.class);
    private final TeamSessionService sessions = new TeamSessionService(store);
    private final TeamDtos.Team team = new TeamDtos.Team(1, "Test club", "", "ACTIVE");
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); TeamContext.clear(); }

    @Test void personalSessionUsesSevenDayIdleTimeoutWithoutAnAbsoluteAgeLimit() {
        when(store.account("test-admin")).thenReturn(Optional.of(new TeamStore.AccountInfo(4, "test-admin", "hash", true, false, 2)));
        when(store.memberships(4)).thenReturn(List.of(new TeamDtos.MyTeam(1, team.name(), "", "ACTIVE", "DIRECTOR")));
        var request = new MockHttpServletRequest();
        sessions.beginAccount("test-admin", null, 2, request, new MockHttpServletResponse());
        assertThat(request.getSession().getMaxInactiveInterval()).isEqualTo(604_800);

        // An active account may remain signed in beyond seven days; the servlet container measures inactivity.
        request.getSession().setAttribute(TeamSessionService.SESSION_KEY,
                new TeamSessionService.SessionState("ACCOUNT", 4L, 1L, 0, Instant.now().minus(Duration.ofDays(8)), 2L));
        request.getSession().setMaxInactiveInterval(30 * 60);
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(sessions.inspect(authentication, request).user().role()).isEqualTo("DIRECTOR");
        assertThat(request.getSession().getMaxInactiveInterval()).isEqualTo(604_800);
    }

    @Test void featureFixtureKeepsExplicitRequestPrincipalAndUsesPersistedVersion() {
        var jdbc = mock(org.springframework.jdbc.core.JdbcTemplate.class);
        when(jdbc.queryForMap("SELECT id, credential_version FROM accounts WHERE username=?", "test-member"))
                .thenReturn(java.util.Map.of("id", 2L, "credential_version", 7L));
        var request = org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors
                .user("test-member").roles("MEMBER").postProcessRequest(new MockHttpServletRequest());
        TeamTestData.accountSession(jdbc).postProcessRequest(request);
        var state = (TeamSessionService.SessionState) request.getSession().getAttribute(TeamSessionService.SESSION_KEY);
        assertThat(state.accountId()).isEqualTo(2L);
        assertThat(state.teamId()).isEqualTo(1L);
        assertThat(state.credentialVersion()).isEqualTo(7L);
    }

    @Test void featureFixtureDoesNotRefreshAnExistingStaleSession() {
        var jdbc = mock(org.springframework.jdbc.core.JdbcTemplate.class);
        var request = new MockHttpServletRequest();
        var stale = new TeamSessionService.SessionState("ACCOUNT", 2L, 1L, 0, Instant.now(), 0L);
        request.getSession().setAttribute(TeamSessionService.SESSION_KEY, stale);
        TeamTestData.accountSession(jdbc).postProcessRequest(request);
        assertThat(request.getSession().getAttribute(TeamSessionService.SESSION_KEY)).isSameAs(stale);
        verifyNoInteractions(jdbc);
    }

    @Test void platformAdministratorWithoutMembershipHasNoTeamWriteRole() {
        when(store.account("test-owner")).thenReturn(Optional.of(new TeamStore.AccountInfo(3, "test-owner", "hash", true, true, 0)));
        when(store.memberships(3)).thenReturn(List.of());
        var request = new MockHttpServletRequest();
        sessions.beginAccount("test-owner", null, 0, request, new MockHttpServletResponse());
        var result = sessions.inspect(UsernamePasswordAuthenticationToken.authenticated("test-owner", null, List.of()), request);
        assertThat(result.user().serviceAdmin()).isTrue();
        assertThat(result.user().role()).isEqualTo("MEMBER");
        assertThat(result.user().team()).isNull();
        assertThat(result.authorities()).extracting(Object::toString).containsExactly("ROLE_MEMBER", "ROLE_SERVICE_ADMIN");
    }
    @Test void removedMembershipStopsAccessWithoutEndingPersonalLogin() {
        var request = new MockHttpServletRequest();
        var authentication = UsernamePasswordAuthenticationToken.authenticated("test-admin", null, List.of());
        when(store.account("test-admin")).thenReturn(Optional.of(new TeamStore.AccountInfo(4, "test-admin", "hash", true, false, 0)));
        when(store.memberships(4)).thenReturn(List.of(new TeamDtos.MyTeam(1, team.name(), "", "ACTIVE", "DIRECTOR")));
        sessions.beginAccount("test-admin", null, 0, request, new MockHttpServletResponse());
        assertThat(sessions.inspect(authentication, request).user().role()).isEqualTo("DIRECTOR");
        when(store.memberships(4)).thenReturn(List.of());
        var revoked = sessions.inspect(authentication, request);
        assertThat(revoked.user().team()).isNull();
        assertThat(revoked.user().authType()).isEqualTo("ACCOUNT");
        assertThat(revoked.user().role()).isEqualTo("MEMBER");
    }
    @Test void changedCredentialsInvalidateEveryPersonalSessionAndCannotBeRefreshedBySelectingATeam() {
        var account = new TeamStore.AccountInfo(4, "test-admin", "hash", true, false, 2);
        when(store.account("test-admin")).thenReturn(Optional.of(account));
        when(store.memberships(4)).thenReturn(List.of(new TeamDtos.MyTeam(1, team.name(), "", "ACTIVE", "DIRECTOR")));
        var first = new MockHttpServletRequest();
        var other = new MockHttpServletRequest();
        sessions.beginAccount("test-admin", null, 2, first, new MockHttpServletResponse());
        sessions.beginAccount("test-admin", null, 2, other, new MockHttpServletResponse());
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        var changed = new TeamStore.AccountInfo(4, "test-admin", "changed-hash", true, false, 3);
        when(store.account("test-admin")).thenReturn(Optional.of(changed));
        when(store.account(4)).thenReturn(Optional.of(changed));
        for (var request : List.of(first, other)) {
            assertThatThrownBy(() -> sessions.inspect(authentication, request)).isInstanceOf(TeamAccessException.class)
                    .extracting(e -> ((TeamAccessException) e).code()).isEqualTo("SESSION_EXPIRED");
            assertThatThrownBy(() -> sessions.select(1, request)).isInstanceOf(TeamAccessException.class);
            assertThatThrownBy(() -> sessions.beginAccount("test-admin", null, 2, request, new MockHttpServletResponse()))
                    .isInstanceOf(TeamAccessException.class);
        }
        assertThatThrownBy(() -> sessions.beginAccount("test-admin", null, 2L, new MockHttpServletRequest(), new MockHttpServletResponse()))
                .isInstanceOf(TeamAccessException.class);
        var fresh = new MockHttpServletRequest();
        sessions.beginAccount("test-admin", null, 3L, fresh, new MockHttpServletResponse());
        assertThat(sessions.inspect(authentication, fresh).user().username()).isEqualTo("test-admin");
    }
    @Test void legacyOrMissingPersonalStateRequiresFreshLogin() {
        when(store.account("test-admin")).thenReturn(Optional.of(new TeamStore.AccountInfo(4, "test-admin", "hash", true, false, 0)));
        var authentication = UsernamePasswordAuthenticationToken.authenticated("test-admin", null, List.of());
        var request = new MockHttpServletRequest();
        assertThatThrownBy(() -> sessions.inspect(authentication, request)).isInstanceOf(TeamAccessException.class);
        request.getSession().setAttribute(TeamSessionService.SESSION_KEY,
                new TeamSessionService.SessionState("ACCOUNT", 4L, null, 0, Instant.now()));
        assertThatThrownBy(() -> sessions.inspect(authentication, request)).isInstanceOf(TeamAccessException.class);
    }
    @Test void rotationInvalidatesEveryCodeSessionAndAbsoluteExpiryCannotBeExtendedByActivity() {
        Instant now = Instant.now();
        var code = new TeamStore.CodeInfo(1, "hash", "password-hash", 3, now, now.plus(Duration.ofDays(90)), null);
        when(store.code(1)).thenReturn(Optional.of(code)); when(store.team(1)).thenReturn(Optional.of(team));
        var request = new MockHttpServletRequest();
        sessions.beginCode(code, team, request, new MockHttpServletResponse());
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(sessions.inspect(authentication, request).user().authType()).isEqualTo("TEAM_CODE");
        assertThat(request.getSession().getMaxInactiveInterval()).isEqualTo(86_400);
        when(store.code(1)).thenReturn(Optional.of(new TeamStore.CodeInfo(1, "other", "new-password-hash", 4, now, now.plus(Duration.ofDays(90)), null)));
        assertThatThrownBy(() -> sessions.inspect(authentication, request)).isInstanceOf(TeamAccessException.class)
                .extracting(e -> ((TeamAccessException) e).code()).isEqualTo("CODE_SESSION_EXPIRED");
        when(store.code(1)).thenReturn(Optional.of(code));
        request.getSession().setAttribute(TeamSessionService.SESSION_KEY,
                new TeamSessionService.SessionState("TEAM_CODE", null, 1L, 3, now.minus(Duration.ofDays(8))));
        assertThatThrownBy(() -> sessions.inspect(authentication, request)).isInstanceOf(TeamAccessException.class);
    }
    @Test void codeAuthenticationReplacesSessionAndNeverCarriesAdminAuthorities() {
        var request = new MockHttpServletRequest();
        String original = request.getSession().getId();
        Instant now = Instant.now();
        var result = sessions.beginCode(new TeamStore.CodeInfo(1, "hash", "password-hash", 1, now, now.plus(Duration.ofDays(90)), null), team, request, new MockHttpServletResponse());
        assertThat(request.getSession().getId()).isNotEqualTo(original);
        assertThat(request.getSession().getMaxInactiveInterval()).isEqualTo(86_400);
        assertThat(result.serviceAdmin()).isFalse();
        assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities()).extracting(Object::toString).containsExactly("ROLE_MEMBER");
    }
    @Test void passwordlessLegacyCodeCannotStartOrContinueAViewerSession() {
        Instant now = Instant.now();
        var legacy = new TeamStore.CodeInfo(1, "hash", null, 1, now, now.plus(Duration.ofDays(90)), null);
        when(store.code(1)).thenReturn(Optional.of(legacy)); when(store.team(1)).thenReturn(Optional.of(team));
        var request = new MockHttpServletRequest();
        request.getSession().setAttribute(TeamSessionService.SESSION_KEY,
                new TeamSessionService.SessionState("TEAM_CODE", null, 1L, 1, now));
        String original = request.getSession().getId();
        var authentication = UsernamePasswordAuthenticationToken.authenticated("viewer", null, List.of());
        assertThatThrownBy(() -> sessions.inspect(authentication, request)).isInstanceOf(TeamAccessException.class)
                .extracting(e -> ((TeamAccessException) e).code()).isEqualTo("CODE_SESSION_EXPIRED");
        assertThatThrownBy(() -> sessions.beginCode(legacy, team, request, new MockHttpServletResponse()))
                .isInstanceOf(TeamAccessException.class);
        assertThat(request.getSession().getId()).isEqualTo(original);
    }
}
