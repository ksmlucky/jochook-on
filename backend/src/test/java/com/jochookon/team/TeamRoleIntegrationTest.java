package com.jochookon.team;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Tag("integration") @Testcontainers
@SpringBootTest(properties = {"spring.datasource.password=unused-test-password", "jochookon.bootstrap.admin.username=",
        "jochookon.bootstrap.admin.password=", "jochookon.bootstrap.service-admin-username="})
@AutoConfigureMockMvc
class TeamRoleIntegrationTest {
    @Container @ServiceConnection static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired TeamManagementService teams;
    @Autowired TeamCodeService codes;
    @Autowired PlatformTransactionManager transactions;
    private static final AtomicInteger IPS = new AtomicInteger();
    private String ip;
    private MockHttpSession director, coach, member, owner;

    @BeforeEach void setup() throws Exception {
        ip = "203.0.113." + IPS.incrementAndGet();
        for (String table : List.of("match_record_events", "match_planned_lineups", "match_appearances", "match_quarters", "match_participants", "match_records", "players",
                "team_code_events", "team_creation_requests", "team_invites", "team_codes", "team_memberships", "accounts")) jdbc.update("DELETE FROM " + table);
        jdbc.update("DELETE FROM teams WHERE id<>1");
        jdbc.update("UPDATE teams SET status='ACTIVE' WHERE id=1");
        jdbc.update("INSERT INTO team_codes(team_id) VALUES(1)");
        TeamTestData.seed(jdbc);
        String password = new BCryptPasswordEncoder(4).encode("test-only-password");
        jdbc.update("INSERT INTO accounts(username,password_hash,role,enabled,service_admin) VALUES ('test-coach',?,'MEMBER',1,0),('test-owner',?,'ADMIN',1,1)", password, password);
        jdbc.update("INSERT INTO team_memberships(team_id,account_id,role) SELECT 1,id,'COACH' FROM accounts WHERE username='test-coach'");
        director = login("test-admin"); coach = login("test-coach"); member = login("test-member"); owner = login("test-owner");
    }

    @ParameterizedTest @ValueSource(strings = {"DIRECTOR", "COACH"})
    void directorAndCoachCanWritePlayersMatchesGuestsAndUseImports(String role) throws Exception {
        MockHttpSession session = role.equals("DIRECTOR") ? director : coach;
        JsonNode player = body(call(post("/api/v1/players").session(session).header("X-Team-Id", "1").with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"권한 검증 선수\",\"position\":\"UN\"}"))
                .andExpect(status().isCreated()));
        call(put("/api/v1/players/" + player.path("id").asLong()).session(session).header("X-Team-Id", "1").with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"수정 검증 선수\",\"position\":\"UN\",\"version\":0}"))
                .andExpect(status().isOk());
        call(post("/api/v1/players/guests").session(session).header("X-Team-Id", "1").with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"권한 검증 용병\"}"))
                .andExpect(status().isCreated());
        String match = "{\"playedOn\":\"2026-10-14\",\"kickoff\":\"11:00:00\",\"venue\":\"\",\"opponent\":\"\",\"notes\":\"\",\"participants\":[],\"quarters\":[{\"number\":1,\"lineup\":[]},{\"number\":2,\"lineup\":[]},{\"number\":3,\"lineup\":[]},{\"number\":4,\"lineup\":[]}]}";
        JsonNode created = body(call(post("/api/v1/matches").session(session).header("X-Team-Id", "1").with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(match)).andExpect(status().isCreated()));
        call(put("/api/v1/matches/" + created.path("id").asLong()).session(session).header("X-Team-Id", "1").with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(match.replace("\"participants\"", "\"version\":0,\"participants\"")))
                .andExpect(status().isOk());
        for (String path : List.of("/api/v1/players/import/template", "/api/v1/matches/import/template"))
            call(get(path).session(session).header("X-Team-Id", "1")).andExpect(status().isOk());
        // Reaches request validation, proving this authenticated role passes the suggestion write gate.
        call(post("/api/v1/matches/lineup-suggestion").session(session).header("X-Team-Id", "1").with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        call(post("/api/v1/team/code").session(session).header("X-Team-Id", "1").with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isOk());
    }
    @Test void memberCodeViewerAndUnassignedServiceAdminCannotWriteAnyTeamFeature() throws Exception {
        MockHttpSession viewer = viewer();
        for (MockHttpSession session : List.of(member, viewer, owner)) {
            for (String path : List.of("/api/v1/players", "/api/v1/players/guests", "/api/v1/players/bulk", "/api/v1/players/bulk/preview",
                    "/api/v1/players/import/preview", "/api/v1/matches", "/api/v1/matches/import/preview", "/api/v1/matches/lineup-suggestion", "/api/v1/team/code")) {
                call(post(path).session(session).header("X-Team-Id", "1").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                        .andExpect(status().isForbidden());
            }
            for (String path : List.of("/api/v1/players/1", "/api/v1/matches/1"))
                call(put(path).session(session).header("X-Team-Id", "1").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                        .andExpect(status().isForbidden());
            for (String path : List.of("/api/v1/matches/history", "/api/v1/matches/history/1"))
                call(get(path).session(session).header("X-Team-Id", "1")).andExpect(status().isForbidden());
        }
        call(get("/api/v1/players").session(member).header("X-Team-Id", "1")).andExpect(status().isOk());
        call(get("/api/v1/players").session(viewer).header("X-Team-Id", "1")).andExpect(status().isOk());
        call(get("/api/v1/players").session(owner).header("X-Team-Id", "1")).andExpect(status().isForbidden());
    }
    @Test void onlyDirectorCanManageCoachesAndDemotionIsEffectiveInExistingSession() throws Exception {
        for (MockHttpSession denied : List.of(coach, member, owner, viewer())) {
            call(get("/api/v1/team/coaches").session(denied).header("X-Team-Id", "1")).andExpect(status().isForbidden());
            coachPost("/members", denied, Map.of("username", "test-member")).andExpect(status().isForbidden());
        }
        coachPost("/members", director, Map.of("username", "test-member", "role", "DIRECTOR"))
                .andExpect(status().isOk());
        call(get("/api/v1/auth/me").session(member)).andExpect(status().isOk()).andExpect(jsonPath("$.role").value("COACH"));
        call(get("/api/v1/players/import/template").session(member).header("X-Team-Id", "1")).andExpect(status().isOk());
        call(delete("/api/v1/team/coaches/members/" + membership("test-member", 1)).session(director).header("X-Team-Id", "1").with(csrf()))
                .andExpect(status().isNoContent());
        call(get("/api/v1/auth/me").session(member)).andExpect(status().isOk()).andExpect(jsonPath("$.role").value("MEMBER"));
        call(get("/api/v1/players").session(member).header("X-Team-Id", "1")).andExpect(status().isOk());
        call(post("/api/v1/players").session(member).header("X-Team-Id", "1").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("SELECT active FROM team_memberships WHERE id=?", Boolean.class, membership("test-member", 1))).isTrue();
        assertThat(jdbc.queryForObject("SELECT role FROM accounts WHERE username='test-coach'", String.class)).isEqualTo("MEMBER");
    }
    @Test void directorCannotAlterSelfDirectorsForeignMembersOrDirectorInvitations() throws Exception {
        coachPost("/members", director, Map.of("username", "test-admin")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROTECTED_MEMBER"));
        call(delete("/api/v1/team/coaches/members/" + membership("test-admin", 1)).session(director).header("X-Team-Id", "1").with(csrf()))
                .andExpect(status().isConflict());
        teams.addMember(account("test-owner"), 1, "test-owner", "DIRECTOR");
        coachPost("/members", director, Map.of("username", "test-owner")).andExpect(status().isConflict());
        call(delete("/api/v1/team/coaches/members/" + membership("test-owner", 1)).session(director).header("X-Team-Id", "1").with(csrf()))
                .andExpect(status().isConflict());
        var other = teams.create(account("test-owner"), new TeamDtos.CreateTeam(UUID.randomUUID().toString(), "Foreign role club", "", "EXISTING", "test-member", null));
        call(delete("/api/v1/team/coaches/members/" + membership("test-member", other.team().id())).session(director).header("X-Team-Id", "1").with(csrf()))
                .andExpect(status().isNotFound());
        var foreignInvite = teams.invite(account("test-owner"), other.team().id(), "Foreign coach", "COACH");
        var protectedInvite = teams.invite(account("test-owner"), 1, "New director", "DIRECTOR");
        for (long id : List.of(foreignInvite.id(), protectedInvite.id())) {
            var reissue = call(post("/api/v1/team/coaches/invitations/" + id + "/reissue").session(director).header("X-Team-Id", "1").with(csrf()));
            reissue.andExpect(id == foreignInvite.id() ? status().isNotFound() : status().isConflict());
        }
        JsonNode visible = body(call(get("/api/v1/team/coaches").session(director).header("X-Team-Id", "1")).andExpect(status().isOk()));
        assertThat(visible.path("invitations").isEmpty()).isTrue();
    }
    @Test void coachInvitationCannotEscalateAndAcceptingItNeverDemotesAnActiveDirector() throws Exception {
        JsonNode invite = body(coachPost("/invitations", director, Map.of("label", "Invited coach", "role", "DIRECTOR"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("COACH")));
        call(post("/api/v1/auth/invitation/inspect").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("token", invite.path("token").asText()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("COACH"));
        var accepted = call(post("/api/v1/auth/invitation/accept").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("token", invite.path("token").asText(), "username", "new-coach", "password", "new-test-password", "role", "DIRECTOR"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("COACH")).andExpect(jsonPath("$.serviceAdmin").value(false));
        MockHttpSession newcomer = (MockHttpSession) accepted.andReturn().getRequest().getSession(false);
        call(get("/api/v1/team/coaches").session(newcomer).header("X-Team-Id", "1")).andExpect(status().isForbidden());
        var another = teams.inviteCoach(account("test-admin"), 1, "Existing director");
        call(post("/api/v1/auth/invitation/accept").session(director).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("token", another.token()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("DIRECTOR"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM team_memberships WHERE role='DIRECTOR' AND active=1", Integer.class)).isEqualTo(1);
    }
    @Test void removingInvitingDirectorsAuthorityInvalidatesPendingCoachInvitationsUntilReissued() throws Exception {
        var invite = teams.inviteCoach(account("test-admin"), 1, "Pending coach");
        teams.addMember(account("test-owner"), 1, "test-owner", "DIRECTOR");
        teams.removeMember(account("test-owner"), 1, membership("test-admin", 1));
        call(post("/api/v1/auth/invitation/accept").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("token", invite.token(), "username", "stale-coach", "password", "new-test-password"))))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_INVITATION"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM accounts WHERE username='stale-coach'", Integer.class)).isZero();
        var replacement = teams.reissueCoach(account("test-owner"), 1, invite.id());
        call(post("/api/v1/auth/invitation/accept").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("token", replacement.token(), "username", "fresh-coach", "password", "new-test-password"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("COACH"));
    }
    @Test void lastDirectorCannotBeRemovedOrDowngradedEvenByServiceAdministrator() throws Exception {
        assertThatThrownBy(() -> teams.removeMember(account("test-owner"), 1, membership("test-admin", 1)))
                .isInstanceOf(TeamAccessException.class).extracting(error -> ((TeamAccessException) error).code()).isEqualTo("LAST_DIRECTOR");
        assertThatThrownBy(() -> teams.addMember(account("test-owner"), 1, "test-admin", "COACH"))
                .isInstanceOf(TeamAccessException.class).extracting(error -> ((TeamAccessException) error).code()).isEqualTo("LAST_DIRECTOR");
        assertThat(jdbc.queryForObject("SELECT role FROM team_memberships WHERE id=?", String.class, membership("test-admin", 1))).isEqualTo("DIRECTOR");
    }
    @Test void chosenTeamsMembershipControlsRolesAndWrongTeamHeaderIsRejected() throws Exception {
        var other = teams.create(account("test-owner"), new TeamDtos.CreateTeam(UUID.randomUUID().toString(), "Selected role club", "", "EXISTING", "test-owner", null));
        teams.addMember(account("test-owner"), other.team().id(), "test-admin", "COACH");
        call(post("/api/v1/auth/team").session(director).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("teamId", other.team().id()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("COACH"));
        call(get("/api/v1/team/coaches").session(director).header("X-Team-Id", String.valueOf(other.team().id()))).andExpect(status().isForbidden());
        call(get("/api/v1/players").session(director).header("X-Team-Id", "1")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_CHANGED"));
    }
    @Test void directorMutationRechecksRoleAfterWaitingDespiteAnOlderRepeatableReadSnapshot() throws Exception {
        long ownerId = account("test-owner"), actor = account("test-admin");
        teams.addMember(ownerId, 1, "test-owner", "DIRECTOR");
        var snapshotOpened = new CountDownLatch(1); var changed = new CountDownLatch(1);
        try (var executor = Executors.newSingleThreadExecutor()) {
            var future = executor.submit(() -> {
                try {
                    new TransactionTemplate(transactions).executeWithoutResult(status -> {
                        jdbc.queryForObject("SELECT role FROM team_memberships WHERE team_id=1 AND account_id=?", String.class, actor);
                        snapshotOpened.countDown();
                        try { if (!changed.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("test timeout"); }
                        catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new IllegalStateException(error); }
                        teams.addCoach(actor, 1, "test-member");
                    });
                    return "GRANTED";
                } catch (TeamAccessException error) { return error.code(); }
            });
            try {
                assertThat(snapshotOpened.await(10, TimeUnit.SECONDS)).isTrue();
                teams.addMember(ownerId, 1, "test-admin", "COACH");
            } finally { changed.countDown(); }
            assertThat(future.get(10, TimeUnit.SECONDS)).isEqualTo("FORBIDDEN");
        }
        assertThat(jdbc.queryForObject("SELECT role FROM team_memberships WHERE id=?", String.class, membership("test-member", 1))).isEqualTo("MEMBER");
    }
    private MockHttpSession login(String username) throws Exception {
        return (MockHttpSession) call(post("/api/v1/auth/login").with(csrf()).param("username", username).param("password", "test-only-password"))
                .andExpect(status().isNoContent()).andReturn().getRequest().getSession(false);
    }
    private MockHttpSession viewer() throws Exception {
        var issued = codes.issue(1, account("test-admin"), jdbc.queryForObject("SELECT version FROM team_codes WHERE team_id=1", Long.class));
        return (MockHttpSession) call(post("/api/v1/auth/team-code").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("code", issued.code(), "password", issued.password()))))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
    }
    private ResultActions coachPost(String suffix, MockHttpSession session, Object payload) throws Exception {
        return call(post("/api/v1/team/coaches" + suffix).session(session).header("X-Team-Id", "1").with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(payload)));
    }
    private long account(String username) { return jdbc.queryForObject("SELECT id FROM accounts WHERE username=?", Long.class, username); }
    private long membership(String username, long team) { return jdbc.queryForObject("SELECT id FROM team_memberships WHERE account_id=? AND team_id=?", Long.class, account(username), team); }
    private JsonNode body(ResultActions result) throws Exception { return json.readTree(result.andReturn().getResponse().getContentAsString()); }
    private ResultActions call(MockHttpServletRequestBuilder request) throws Exception { return mvc.perform(request.with(r -> { r.setRemoteAddr(ip); return r; })); }
}
