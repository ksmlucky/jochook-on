package com.jochookon.team;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
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

@Tag("integration")
@Testcontainers
@SpringBootTest(properties = {"spring.datasource.password=unused-test-password", "jochookon.bootstrap.admin.username=",
        "jochookon.bootstrap.admin.password=", "jochookon.bootstrap.service-admin-username="})
@AutoConfigureMockMvc
class TeamAccessIntegrationTest {
    @Container @ServiceConnection static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired TeamManagementService management;
    @Autowired TeamCodeService codes;
    @Autowired PlatformTransactionManager transactions;
    private static final AtomicInteger ADDRESSES = new AtomicInteger();
    private String ip;
    private MockHttpSession owner;
    private MockHttpSession admin;

    @BeforeEach void setup() throws Exception {
        ip = "192.0.2." + ADDRESSES.incrementAndGet();
        jdbc.update("DELETE FROM team_code_events");
        jdbc.update("DELETE FROM team_creation_requests");
        jdbc.update("DELETE FROM team_invites");
        jdbc.update("DELETE FROM team_codes");
        jdbc.update("DELETE FROM team_memberships");
        jdbc.update("DELETE FROM accounts");
        jdbc.update("DELETE FROM teams WHERE id <> 1");
        jdbc.update("UPDATE teams SET status = 'ACTIVE' WHERE id = 1");
        jdbc.update("INSERT INTO team_codes (team_id) VALUES (1)");
        TeamTestData.seed(jdbc);
        jdbc.update("INSERT INTO accounts (username, password_hash, role, enabled, service_admin) VALUES (?, ?, 'MEMBER', 1, 1)",
                "test-owner", new BCryptPasswordEncoder(4).encode("test-only-password"));
        owner = login("test-owner"); admin = login("test-admin");
    }

    @Test void serviceAdministrationDoesNotGrantTeamAccessAndTeamAdminCannotCreateTeams() throws Exception {
        call(get("/api/v1/auth/me").session(owner)).andExpect(status().isOk()).andExpect(jsonPath("$.serviceAdmin").value(true))
                .andExpect(jsonPath("$.team").isEmpty()).andExpect(jsonPath("$.role").value("MEMBER"));
        call(get("/api/v1/players").session(owner).header("X-Team-Id", "1")).andExpect(status().isForbidden());
        call(get("/api/v1/team/code").session(owner).header("X-Team-Id", "1")).andExpect(status().isForbidden());
        call(get("/api/v1/service/teams").session(admin)).andExpect(status().isForbidden());
        call(post("/api/v1/service/teams").session(admin).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(createBody(UUID.randomUUID().toString(), "EXISTING")))
                .andExpect(status().isForbidden());
        call(post("/api/v1/auth/team").session(admin).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"teamId\":999999}"))
                .andExpect(status().isForbidden());
    }
    @Test void teamCreationIsAtomicIdempotentAndOnlyGrantsTheNamedOperator() throws Exception {
        String key = UUID.randomUUID().toString();
        String body = createBody(key, "EXISTING");
        JsonNode first = body(call(post("/api/v1/service/teams").session(owner).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk()));
        long team = first.path("team").path("id").asLong();
        call(post("/api/v1/service/teams").session(owner).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.replayed").value(true)).andExpect(jsonPath("$.team.id").value(team));
        call(post("/api/v1/service/teams").session(owner).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body.replace("Test club", "Different club")))
                .andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM teams", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM team_memberships WHERE team_id = ?", Integer.class, team)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT service_admin FROM accounts WHERE username = 'test-admin'", Boolean.class)).isFalse();
        String invalid = createBody(UUID.randomUUID().toString(), "EXISTING").replace("test-admin", "missing-user");
        call(post("/api/v1/service/teams").session(owner).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(invalid)).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM teams", Integer.class)).isEqualTo(2);
    }
    @Test void codeRotationRevokesAllViewerSessionsButKeepsPersonalLogin() throws Exception {
        JsonNode issued = issue(0);
        String code = issued.path("code").asText();
        String normalized = code.replace("-", "");
        assertThat(jdbc.queryForObject("SELECT code_hash FROM team_codes WHERE team_id = 1", String.class)).isNotEqualTo(normalized).hasSize(64);
        String password = issued.path("password").asText();
        assertThat(password).matches("[0-9]{6}");
        String passwordHash = jdbc.queryForObject("SELECT password_hash FROM team_codes WHERE team_id = 1", String.class);
        assertThat(passwordHash).isNotEqualTo(password).startsWith("$2");
        assertThat(new BCryptPasswordEncoder().matches(password, passwordHash)).isTrue();
        MockHttpSession viewerOne = codeLogin(code.toLowerCase(), issued.path("password").asText()), viewerTwo = codeLogin(" " + code + " ", issued.path("password").asText());
        call(get("/api/v1/players").session(viewerOne).header("X-Team-Id", "1")).andExpect(status().isOk());
        call(get("/api/v1/team/code").session(viewerOne).header("X-Team-Id", "1")).andExpect(status().isForbidden());
        call(post("/api/v1/players").session(viewerOne).header("X-Team-Id", "1").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        call(get("/api/v1/team/code").session(admin).header("X-Team-Id", "1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.code").doesNotExist()).andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist()).andExpect(jsonPath("$.password_hash").doesNotExist());
        JsonNode replacement = issue(issued.path("version").asLong());
        assertThat(replacement.path("code").asText()).isNotEqualTo(code);
        assertThat(replacement.path("password").asText()).isNotEqualTo(password);
        call(get("/api/v1/auth/me").session(viewerOne)).andExpect(status().isUnauthorized());
        call(get("/api/v1/auth/me").session(viewerTwo)).andExpect(status().isUnauthorized());
        call(get("/api/v1/auth/me").session(admin)).andExpect(status().isOk()).andExpect(jsonPath("$.role").value("DIRECTOR"));
        call(post("/api/v1/auth/team-code").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("code", code, "password", issued.path("password").asText()))))
                .andExpect(status().isUnauthorized());
        invalidPair(replacement.path("code").asText(), password);
        invalidPair(code, replacement.path("password").asText());
        codeLogin(replacement);
        call(post("/api/v1/team/code").session(admin).header("X-Team-Id", "1").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isConflict());
    }
    @Test void codeExpiryTeamSuspensionAndExplicitRevokeAllStopViewerAccess() throws Exception {
        JsonNode issued = issue(0); MockHttpSession viewer = codeLogin(issued);
        jdbc.update("UPDATE team_codes SET expires_at = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY) WHERE team_id = 1");
        call(get("/api/v1/auth/me").session(viewer)).andExpect(status().isUnauthorized());
        invalidPair(issued.path("code").asText(), issued.path("password").asText());
        issued = issue(1); viewer = codeLogin(issued);
        jdbc.update("UPDATE teams SET status = 'INACTIVE' WHERE id = 1");
        call(get("/api/v1/auth/me").session(viewer)).andExpect(status().isUnauthorized());
        invalidPair(issued.path("code").asText(), issued.path("password").asText());
        jdbc.update("UPDATE teams SET status = 'ACTIVE' WHERE id = 1");
        viewer = codeLogin(issued);
        call(delete("/api/v1/team/code").session(admin).header("X-Team-Id", "1").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REVOKED"));
        call(get("/api/v1/auth/me").session(viewer)).andExpect(status().isUnauthorized());
        invalidPair(issued.path("code").asText(), issued.path("password").asText());
        assertThat(jdbc.queryForObject("SELECT code_hash FROM team_codes WHERE team_id = 1", String.class)).isNull();
        assertThat(jdbc.queryForObject("SELECT password_hash FROM team_codes WHERE team_id = 1", String.class)).isNull();
    }
    @Test void historyShowsLatestEventsWithActorsAndNeverContainsCodeSecrets() throws Exception {
        JsonNode firstIssued = issue(0); String firstCode = firstIssued.path("code").asText();
        long ownerId = jdbc.queryForObject("SELECT id FROM accounts WHERE username = 'test-owner'", Long.class);
        management.addMember(ownerId, 1, "test-owner");
        call(post("/api/v1/auth/team").session(owner).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"teamId\":1}"))
                .andExpect(status().isOk());
        JsonNode rotated = body(call(post("/api/v1/team/code").session(owner).header("X-Team-Id", "1").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk()));
        String secondCode = rotated.path("code").asText();
        String storedHash = jdbc.queryForObject("SELECT code_hash FROM team_codes WHERE team_id = 1", String.class);
        String storedPasswordHash = jdbc.queryForObject("SELECT password_hash FROM team_codes WHERE team_id = 1", String.class);
        call(delete("/api/v1/team/code").session(admin).header("X-Team-Id", "1").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}"))
                .andExpect(status().isOk());
        var history = call(get("/api/v1/team/code/history").session(admin).header("X-Team-Id", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].action").value("REVOKED")).andExpect(jsonPath("$[0].version").value(3))
                .andExpect(jsonPath("$[0].actorUsername").value("test-admin"))
                .andExpect(jsonPath("$[1].action").value("ROTATED")).andExpect(jsonPath("$[1].actorUsername").value("test-owner"))
                .andExpect(jsonPath("$[2].action").value("ISSUED")).andExpect(jsonPath("$[2].version").value(1))
                .andExpect(jsonPath("$[0].occurredAt").isString()).andExpect(jsonPath("$[0].expiresAt").isString());
        assertThat(history.andReturn().getResponse().getContentAsString()).doesNotContain(firstCode, secondCode, storedHash,
                json.writeValueAsString(firstIssued.path("password").asText()), json.writeValueAsString(rotated.path("password").asText()),
                storedPasswordHash, "password", "code_hash", "token");
        var columns = jdbc.queryForList("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'team_code_events'", String.class);
        assertThat(columns).containsExactlyInAnyOrder("id", "team_id", "actor_account_id", "action", "version", "occurred_at", "expires_at");
    }
    @Test void historyIsScopedToTheSelectedTeamAndDeniedToViewersAndUnassignedServiceAdmins() throws Exception {
        JsonNode firstIssued = issue(0); String firstCode = firstIssued.path("code").asText();
        long ownerId = jdbc.queryForObject("SELECT id FROM accounts WHERE username = 'test-owner'", Long.class);
        long adminId = jdbc.queryForObject("SELECT id FROM accounts WHERE username = 'test-admin'", Long.class);
        var other = management.create(ownerId, new TeamDtos.CreateTeam(UUID.randomUUID().toString(), "Other audit club", "", "EXISTING", "test-admin", null));
        codes.issue(other.team().id(), adminId, 0);
        call(get("/api/v1/team/code/history").session(admin).header("X-Team-Id", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        call(get("/api/v1/team/code/history").session(admin).header("X-Team-Id", String.valueOf(other.team().id())))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_CHANGED"));
        call(get("/api/v1/team/code/history").session(codeLogin(firstIssued)).header("X-Team-Id", "1")).andExpect(status().isForbidden());
        call(get("/api/v1/team/code/history").session(login("test-member")).header("X-Team-Id", "1")).andExpect(status().isForbidden());
        call(get("/api/v1/team/code/history").session(owner).header("X-Team-Id", "1")).andExpect(status().isForbidden());
    }
    @Test void historyDefaultsToLatestTwentyAndValidatesRequestedLimit() throws Exception {
        long adminId = jdbc.queryForObject("SELECT id FROM accounts WHERE username = 'test-admin'", Long.class);
        for (int version = 0; version < 25; version++) codes.issue(1, adminId, version);
        call(get("/api/v1/team/code/history").session(admin).header("X-Team-Id", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(20))
                .andExpect(jsonPath("$[0].version").value(25)).andExpect(jsonPath("$[19].version").value(6));
        call(get("/api/v1/team/code/history?limit=1").session(admin).header("X-Team-Id", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        call(get("/api/v1/team/code/history?limit=100").session(admin).header("X-Team-Id", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(25));
        for (int invalid : new int[]{0, 101}) call(get("/api/v1/team/code/history?limit=" + invalid).session(admin).header("X-Team-Id", "1"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }
    @Test void failedEventAppendRollsBackBothCodeRotationAndRevocation() throws Exception {
        JsonNode original = issue(0);
        String previousHash = jdbc.queryForObject("SELECT code_hash FROM team_codes WHERE team_id = 1", String.class);
        String previousPasswordHash = jdbc.queryForObject("SELECT password_hash FROM team_codes WHERE team_id = 1", String.class);
        long adminId = jdbc.queryForObject("SELECT id FROM accounts WHERE username = 'test-admin'", Long.class);
        // Force an append constraint failure after the code UPDATE, entirely inside this disposable test DB.
        jdbc.update("INSERT INTO team_code_events (team_id, actor_account_id, action, version, occurred_at) VALUES (1, ?, 'ROTATED', 2, CURRENT_TIMESTAMP(6))", adminId);
        call(post("/api/v1/team/code").session(admin).header("X-Team-Id", "1").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isConflict());
        call(delete("/api/v1/team/code").session(admin).header("X-Team-Id", "1").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("SELECT version FROM team_codes WHERE team_id = 1", Long.class)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("SELECT code_hash FROM team_codes WHERE team_id = 1", String.class)).isEqualTo(previousHash);
        assertThat(jdbc.queryForObject("SELECT password_hash FROM team_codes WHERE team_id = 1", String.class)).isEqualTo(previousPasswordHash);
        assertThat(jdbc.queryForObject("SELECT revoked_at FROM team_codes WHERE team_id = 1", Object.class)).isNull();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM team_code_events WHERE team_id = 1", Integer.class)).isEqualTo(2);
        codeLogin(original);
    }
    @Test void invitationIsOneUseActivatesTeamAndCannotCreatePlatformAdministrator() throws Exception {
        String key = UUID.randomUUID().toString();
        JsonNode created = body(call(post("/api/v1/service/teams").session(owner).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(createBody(key, "INVITE"))).andExpect(status().isOk()));
        assertThat(created.path("team").path("status").asText()).isEqualTo("PENDING");
        String token = created.path("invitation").path("token").asText();
        call(post("/api/v1/service/teams").session(owner).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(createBody(key, "INVITE")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.invitation").isEmpty());
        call(post("/api/v1/auth/invitation/inspect").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("token", token))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.team.status").value("PENDING"));
        String accept = json.writeValueAsString(Map.of("token", token, "username", "new-operator", "password", "new-test-password"));
        call(post("/api/v1/auth/invitation/accept").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(accept))
                .andExpect(status().isOk()).andExpect(jsonPath("$.authType").value("ACCOUNT")).andExpect(jsonPath("$.role").value("DIRECTOR"))
                .andExpect(jsonPath("$.team.status").value("ACTIVE")).andExpect(jsonPath("$.serviceAdmin").value(false));
        call(post("/api/v1/auth/invitation/accept").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(accept)).andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM accounts WHERE username = 'new-operator'", Integer.class)).isEqualTo(1);
    }
    @Test void sixDigitPasswordPreservesLeadingZerosAndRejectsMissingOrNonAsciiValues() throws Exception {
        JsonNode issued = issue(0); String code = issued.path("code").asText();
        jdbc.update("UPDATE team_codes SET password_hash = ? WHERE team_id = 1", new BCryptPasswordEncoder(4).encode("000007"));
        codeLogin(code, "000007");
        for (String invalid : new String[]{"", "00007", "0000007", "１２３４５６", "١٢٣٤٥٦", " 000007", "000007 "}) invalidPair(code, invalid);
        call(post("/api/v1/auth/team-code").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("code", code))))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CODE"));
        call(post("/api/v1/auth/team-code").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("code", code)).replace("}", ",\"password\":null}")))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CODE"));
        codeLogin(code, "000007");
    }
    @Test void wrongPasswordDoesNotReplaceExistingSessionOrSwitchToAnotherTeam() throws Exception {
        JsonNode issued = issue(0); String code = issued.path("code").asText();
        jdbc.update("UPDATE team_codes SET password_hash = ? WHERE team_id = 1", new BCryptPasswordEncoder(4).encode("000007"));
        MockHttpSession viewer = codeLogin(code, "000007"); String sessionId = viewer.getId();
        long ownerId = jdbc.queryForObject("SELECT id FROM accounts WHERE username = 'test-owner'", Long.class);
        long adminId = jdbc.queryForObject("SELECT id FROM accounts WHERE username = 'test-admin'", Long.class);
        var other = management.create(ownerId, new TeamDtos.CreateTeam(UUID.randomUUID().toString(), "Other password club", "", "EXISTING", "test-admin", null));
        var otherCode = codes.issue(other.team().id(), adminId, 0);
        jdbc.update("UPDATE team_codes SET password_hash = ? WHERE team_id = ?", new BCryptPasswordEncoder(4).encode("654321"), other.team().id());
        invalidPair(code, "654321");
        var failure = call(post("/api/v1/auth/team-code").session(viewer).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("code", otherCode.code(), "password", "000007"))))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CODE"));
        assertThat(failure.andReturn().getRequest().getSession(false).getId()).isEqualTo(sessionId);
        call(get("/api/v1/auth/me").session(viewer)).andExpect(status().isOk()).andExpect(jsonPath("$.team.id").value(1));
        codeLogin(otherCode.code(), "654321");
    }
    @Test void legacyPasswordlessCodeRejectsLoginAndExistingViewerSessionWithoutExposingItAsActive() throws Exception {
        JsonNode issued = issue(0); MockHttpSession viewer = codeLogin(issued);
        jdbc.update("UPDATE team_codes SET password_hash = NULL WHERE team_id = 1");
        invalidPair(issued.path("code").asText(), issued.path("password").asText());
        call(get("/api/v1/auth/me").session(viewer)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("CODE_SESSION_EXPIRED"));
        call(get("/api/v1/team/code").session(admin).header("X-Team-Id", "1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVOKED")).andExpect(jsonPath("$.password").doesNotExist());
    }
    @Test void codeSpecificLimitSurvivesChangesOfClientIpAndFormattingWithoutRevokingValidViewers() throws Exception {
        JsonNode issued = issue(0); String code = issued.path("code").asText();
        MockHttpSession viewer = codeLogin(issued);
        String incorrect = issued.path("password").asText().equals("000000") ? "000001" : "000000";
        for (int i = 0; i < 10; i++) {
            ip = "198.51.100." + (i + 1);
            invalidPair(i % 2 == 0 ? code : " " + code.toLowerCase().replace("-", " ") + " ", incorrect);
        }
        ip = "198.51.100.11";
        call(post("/api/v1/auth/team-code").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("code", code, "password", issued.path("password").asText()))))
                .andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("RATE_LIMITED"));
        invalidPair("ZZZZ-YYYY-XXXX", "000007");
        call(get("/api/v1/auth/me").session(viewer)).andExpect(status().isOk()).andExpect(jsonPath("$.team.id").value(1));
        call(get("/api/v1/auth/me").session(admin)).andExpect(status().isOk()).andExpect(jsonPath("$.role").value("DIRECTOR"));
    }
    @Test void existingAccountPasswordIsNotOverwrittenAndInvitationCanBeAcceptedAfterLogin() throws Exception {
        JsonNode invitation = invite(); String token = invitation.path("token").asText();
        String previousHash = jdbc.queryForObject("SELECT password_hash FROM accounts WHERE username = 'test-admin'", String.class);
        call(post("/api/v1/auth/invitation/accept").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("token", token, "username", "test-admin", "password", "changed-test-password"))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ACCOUNT_EXISTS"));
        assertThat(jdbc.queryForObject("SELECT password_hash FROM accounts WHERE username = 'test-admin'", String.class)).isEqualTo(previousHash);
        call(post("/api/v1/auth/invitation/accept").session(admin).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("token", token))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.username").value("test-admin"));
    }
    @Test void expiredCancelledAndSupersededInvitationLinksCannotBeUsed() throws Exception {
        JsonNode invitation = invite(); long id = invitation.path("id").asLong(); String token = invitation.path("token").asText();
        JsonNode reissued = body(call(post("/api/v1/service/teams/1/invitations/" + id + "/reissue").session(owner).with(csrf())).andExpect(status().isOk()));
        inspectInvalid(token);
        call(delete("/api/v1/service/teams/1/invitations/" + id).session(owner).with(csrf())).andExpect(status().isNoContent());
        inspectInvalid(reissued.path("token").asText());
        JsonNode expired = invite();
        jdbc.update("UPDATE team_invites SET expires_at = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY) WHERE id = ?", expired.path("id").asLong());
        inspectInvalid(expired.path("token").asText());
    }
    @Test void lastAdministratorCannotBeRemovedAndRemovalRevokesExistingAccess() throws Exception {
        long memberId = jdbc.queryForObject("SELECT m.id FROM team_memberships m JOIN accounts a ON a.id = m.account_id WHERE m.team_id = 1 AND a.username = 'test-admin'", Long.class);
        call(delete("/api/v1/service/teams/1/members/" + memberId).session(owner).with(csrf())).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LAST_DIRECTOR"));
        call(post("/api/v1/service/teams/1/members").session(owner).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"test-owner\"}"))
                .andExpect(status().isOk());
        call(delete("/api/v1/service/teams/1/members/" + memberId).session(owner).with(csrf())).andExpect(status().isNoContent());
        call(get("/api/v1/players").session(admin).header("X-Team-Id", "1")).andExpect(status().isForbidden());
        call(get("/api/v1/auth/me").session(admin)).andExpect(status().isOk()).andExpect(jsonPath("$.team").isEmpty());
    }
    @Test void newPublicAuthenticationEndpointsStillRequireCsrfAndInvalidInputsAreLimited() throws Exception {
        call(post("/api/v1/auth/team-code").contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"invalid\"}"))
                .andExpect(status().isForbidden());
        for (int i = 0; i < 10; i++) call(post("/api/v1/auth/team-code").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"invalid\"}"))
                .andExpect(status().isUnauthorized());
        call(post("/api/v1/auth/team-code").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"invalid\"}"))
                .andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After")).andExpect(jsonPath("$.retryAfterSeconds").isNumber());
    }
    @Test void concurrentRemovalAlwaysLeavesAnActiveAdministrator() throws Exception {
        long ownerId = jdbc.queryForObject("SELECT id FROM accounts WHERE username = 'test-owner'", Long.class);
        management.addMember(ownerId, 1, "test-owner");
        var ids = jdbc.queryForList("SELECT id FROM team_memberships WHERE team_id = 1 AND role = 'DIRECTOR' AND active = 1 ORDER BY id", Long.class);
        var snapshotBarrier = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var futures = ids.stream().map(id -> executor.submit(() -> {
                try {
                    return new TransactionTemplate(transactions).execute(status -> {
                        openSnapshotAndWait(snapshotBarrier);
                        management.removeMember(ownerId, 1, id);
                        return "REMOVED";
                    });
                }
                catch (TeamAccessException exception) { return exception.code(); }
            })).toList();
            assertThat(futures.get(0).get(15, TimeUnit.SECONDS)).isIn("REMOVED", "LAST_DIRECTOR");
            assertThat(futures.get(1).get(15, TimeUnit.SECONDS)).isIn("REMOVED", "LAST_DIRECTOR");
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM team_memberships WHERE team_id = 1 AND role = 'DIRECTOR' AND active = 1", Integer.class)).isEqualTo(1);
    }
    @Test void simultaneousCreationRetriesCreateExactlyOneTeamAndReturnOneInvitationSecret() throws Exception {
        long ownerId = jdbc.queryForObject("SELECT id FROM accounts WHERE username = 'test-owner'", Long.class);
        var request = new TeamDtos.CreateTeam(UUID.randomUUID().toString(), "Concurrent club", "", "INVITE", null, "Test recipient");
        var snapshotBarrier = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> new TransactionTemplate(transactions).execute(status -> { openSnapshotAndWait(snapshotBarrier); return management.create(ownerId, request); }));
            var second = executor.submit(() -> new TransactionTemplate(transactions).execute(status -> { openSnapshotAndWait(snapshotBarrier); return management.create(ownerId, request); }));
            var a = first.get(15, TimeUnit.SECONDS); var b = second.get(15, TimeUnit.SECONDS);
            assertThat(a.team().id()).isEqualTo(b.team().id());
            assertThat(a.replayed()).isNotEqualTo(b.replayed());
            assertThat(a.invitation() == null).isNotEqualTo(b.invitation() == null);
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM teams", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM team_invites", Integer.class)).isEqualTo(1);
    }
    private void openSnapshotAndWait(CyclicBarrier barrier) {
        jdbc.queryForObject("SELECT COUNT(*) FROM accounts", Integer.class);
        try { barrier.await(10, TimeUnit.SECONDS); }
        catch (Exception exception) { throw new IllegalStateException(exception); }
    }
    private MockHttpSession login(String username) throws Exception {
        return (MockHttpSession) call(post("/api/v1/auth/login").with(csrf()).param("username", username).param("password", "test-only-password"))
                .andExpect(status().isNoContent()).andReturn().getRequest().getSession(false);
    }
    private MockHttpSession codeLogin(String code, String password) throws Exception {
        return (MockHttpSession) call(post("/api/v1/auth/team-code").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("code", code, "password", password))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.authType").value("TEAM_CODE")).andReturn().getRequest().getSession(false);
    }
    private MockHttpSession codeLogin(JsonNode issued) throws Exception {
        return codeLogin(issued.path("code").asText(), issued.path("password").asText());
    }
    private ResultActions invalidPair(String code, String password) throws Exception {
        return call(post("/api/v1/auth/team-code").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("code", code, "password", password))))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CODE"))
                .andExpect(jsonPath("$.message").value("팀 코드 또는 팀 비밀번호를 확인해 주세요. 운영진에게 받은 최신 정보를 입력해 주세요."))
                .andExpect(jsonPath("$.team").doesNotExist());
    }
    private JsonNode issue(long version) throws Exception {
        return body(call(post("/api/v1/team/code").session(admin).header("X-Team-Id", "1").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", version)))).andExpect(status().isOk()));
    }
    private JsonNode invite() throws Exception {
        return body(call(post("/api/v1/service/teams/1/invitations").session(owner).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"label\":\"Test invite\"}"))
                .andExpect(status().isOk()));
    }
    private void inspectInvalid(String token) throws Exception {
        call(post("/api/v1/auth/invitation/inspect").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("token", token))))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.team").doesNotExist());
    }
    private String createBody(String requestId, String type) throws Exception {
        return json.writeValueAsString(Map.of("requestId", requestId, "name", "Test club", "description", "", "assignmentType", type, "username", "test-admin", "inviteLabel", "Test operator"));
    }
    private JsonNode body(ResultActions result) throws Exception { return json.readTree(result.andReturn().getResponse().getContentAsString()); }
    private ResultActions call(MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request.with(r -> { r.setRemoteAddr(ip); return r; }));
    }
}
