package com.jochookon.player;

import static com.jochookon.player.TeamScopedRequests.get;
import static com.jochookon.player.TeamScopedRequests.post;
import static com.jochookon.player.TeamScopedRequests.put;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

@Tag("integration")
@Testcontainers
@SpringBootTest(properties = {"spring.datasource.password=unused-test-password",
        "jochookon.bootstrap.admin.username=", "jochookon.bootstrap.admin.password=",
        "jochookon.bootstrap.service-admin-username="})
@AutoConfigureMockMvc
class PlayerIntegrationTest {
    @Container
    @ServiceConnection
    static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    MockMvc mvc;

    @BeforeEach
    void seedOnlyTheIsolatedTestDatabase() {
        com.jochookon.team.TeamTestData.seed(jdbc);
        jdbc.update("DELETE FROM players");
        jdbc.update("INSERT INTO players(team_id,name, shirt_number, position, active) VALUES (1,?, ?, ?, ?)",
                "첫 번째 선수", 7, "FW", true);
        jdbc.update("INSERT INTO players(team_id,name, shirt_number, position, active) VALUES (1,?, ?, ?, ?)",
                "활동 종료 선수", 9, "DF", false);
        jdbc.update("INSERT INTO players(team_id,name, shirt_number, position, active) VALUES (1,?, ?, ?, ?)",
                "두 번째 선수", null, "GK", true);
    }

    @Test
    @WithMockUser(username = "test-member", roles = "MEMBER")
    void flywaySchemaAndJpaReturnOnlyActivePlayersWithStablePagination() throws Exception {
        mvc.perform(get("/api/v1/players?page=0&size=1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.items[0].name").value("첫 번째 선수"));
        mvc.perform(get("/api/v1/players?page=1&size=1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].name").value("두 번째 선수"))
                .andExpect(jsonPath("$.items[0].shirtNumber").isEmpty());
    }

    @Test @WithMockUser(username = "test-admin", roles = "DIRECTOR") void guestsHavePersistentIdentityAndSeparateRegistryWithoutInventedShirtNumbers() throws Exception {
        for (int i = 0; i < 2; i++) mvc.perform(post("/api/v1/players/guests").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"검증 용병\",\"firstChoice\":\"CM\",\"secondChoice\":\"GK\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.playerType").value("GUEST"))
                .andExpect(jsonPath("$.shirtNumber").isEmpty()).andExpect(jsonPath("$.joinedOn").isEmpty());
        mvc.perform(get("/api/v1/players")).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/v1/players/guests?size=1&page=0")).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.items[0].playerType").value("GUEST"));
        Long guest = jdbc.queryForObject("SELECT MIN(id) FROM players WHERE player_type='GUEST'", Long.class);
        mvc.perform(get("/api/v1/players/" + guest)).andExpect(status().isOk()).andExpect(jsonPath("$.secondChoice").value("GK"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM players WHERE player_type='MEMBER'", Integer.class)).isEqualTo(3);
        mvc.perform(post("/api/v1/players/guests").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"번호 충돌\",\"shirtNumber\":7}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/players/guests").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"선호 중복\",\"firstChoice\":\"CM\",\"secondChoice\":\"CM\"}"))
                .andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM players WHERE player_type='GUEST'", Integer.class)).isEqualTo(2);
    }

    @Test
    @WithMockUser(username = "test-admin", roles = "DIRECTOR")
    void persistsEditsAndRejectsStaleVersionWithoutLosingTheNewerData() throws Exception {
        mvc.perform(post("/api/v1/players").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"name":"등록 테스트","position":"MF","firstChoice":"CM","shirtNumber":1,"joinedOn":"2026-10-13"}
                """))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.version").value(0));
        Long id = jdbc.queryForObject("SELECT id FROM players WHERE name = ?", Long.class, "등록 테스트");
        String update = """
                {"name":"수정 테스트","position":"GK","firstChoice":"CM","shirtNumber":null,"joinedOn":null,"version":0}
                """;
        mvc.perform(put("/api/v1/players/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(update))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.shirtNumber").isEmpty()).andExpect(jsonPath("$.joinedOn").isEmpty());
        mvc.perform(put("/api/v1/players/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(update))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/v1/players/" + id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("수정 테스트")).andExpect(jsonPath("$.version").value(1));
        assertThat(jdbc.queryForObject("SELECT version FROM players WHERE id = ?", Long.class, id)).isEqualTo(1);
    }

    @Test
    @WithMockUser(username = "test-admin", roles = "DIRECTOR")
    void storesUnknownPositionAndProfileAndProtectsAtomicBulkWrites() throws Exception {
        mvc.perform(post("/api/v1/players").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"name":"프로필 테스트","position":"UN","birthYear":1996,"clubRole":"코치"}
                """))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.birthYear").value(1996))
                .andExpect(jsonPath("$.clubRole").value("코치")).andExpect(jsonPath("$.firstChoice").isEmpty());
        long id = jdbc.queryForObject("SELECT id FROM players WHERE name='프로필 테스트'", Long.class);
        mvc.perform(get("/api/v1/players/" + id)).andExpect(jsonPath("$.birthYear").value(1996));
        assertThatThrownBy(() -> jdbc.update("UPDATE players SET first_choice='CM' WHERE id=?", id)).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE players SET birth_year=1899 WHERE id=?", id)).isInstanceOf(org.springframework.dao.DataAccessException.class);
        long before = jdbc.queryForObject("SELECT COUNT(*) FROM players", Long.class);
        mvc.perform(post("/api/v1/players/bulk").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"rows":[{"name":"정상 프로필","position":"UN","birthYear":"1996"},
                {"name":"미래 프로필","position":"UN","birthYear":"9999"}]}
                """ )).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM players", Long.class)).isEqualTo(before);
        mvc.perform(put("/api/v1/players/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"name":"프로필 테스트","position":"MF","firstChoice":"CM","birthYear":null,"clubRole":null,"version":0}
                """ )).andExpect(status().isOk()).andExpect(jsonPath("$.birthYear").isEmpty())
                .andExpect(jsonPath("$.clubRole").value("정회원")).andExpect(jsonPath("$.version").value(1));
        assertThat(jdbc.queryForObject("SELECT birth_year FROM players WHERE id=?", Integer.class, id)).isNull();
    }

    @Test
    @WithMockUser(username = "test-admin", roles = "DIRECTOR")
    void bulkImportIsAtomicAndPreferencesPersistWithDatabaseConstraints() throws Exception {
        long before = jdbc.queryForObject("SELECT COUNT(*) FROM players", Long.class);
        mvc.perform(post("/api/v1/players/bulk").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"rows":[{"name":"정상 선수","position":"MF","firstChoice":"CM"},
                         {"name":"잘못된 선수","position":"MF","firstChoice":"CM","secondChoice":"CM"}]}
                """))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.rows[1].errors").isNotEmpty());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM players", Long.class)).isEqualTo(before);
        mvc.perform(post("/api/v1/players/bulk").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"rows":[{"name":"일괄 선수1","position":"MF","firstChoice":"CM","secondChoice":"CDM","thirdChoice":"ST"},
                         {"name":"일괄 선수2","position":"GK","firstChoice":"GK"}]}
                """))
                .andExpect(status().isCreated()).andExpect(jsonPath("$[0].firstChoice").value("CM"))
                .andExpect(jsonPath("$[0].thirdChoice").value("ST")).andExpect(jsonPath("$[1].secondChoice").isEmpty());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM players", Long.class)).isEqualTo(before + 2);
        assertThat(jdbc.queryForObject("SELECT third_choice FROM players WHERE name = '일괄 선수1'", String.class)).isEqualTo("ST");
        assertThatThrownBy(() -> jdbc.update("UPDATE players SET second_choice = first_choice WHERE name = '일괄 선수1'"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM players WHERE first_choice IS NULL", Long.class)).isEqualTo(before);
    }

    @Test
    @WithMockUser(username = "test-member", roles = "MEMBER")
    void sortsByFirstPreferenceGroupInBothDirectionsAcrossPages() throws Exception {
        jdbc.update("DELETE FROM players");
        String[] choices = {"ST", "RB", "CM", "GK", "LB", "LW", "CDM", "CB", "RW"};
        int[] shirts = {35, 13, 22, 1, 11, 32, 21, 12, 31};
        for (int i = 0; i < choices.length; i++) {
            // Basic position deliberately disagrees; only first preference determines the group.
            jdbc.update("INSERT INTO players(team_id,name,shirt_number,position,first_choice,active) VALUES (1,?,?,'GK',?,true)",
                    "포지션 검증 " + choices[i], shirts[i], choices[i]);
        }
        jdbc.update("UPDATE players SET second_choice='GK' WHERE first_choice='ST'");
        jdbc.update("INSERT INTO players(team_id,name,position,first_choice,active) VALUES (1,'번호 없는 키퍼','GK','GK',true)");
        jdbc.update("INSERT INTO players(team_id,name,shirt_number,position,active) VALUES (1,'미확인',2,'UN',true),(1,'기존 미입력',3,'GK',true)");
        jdbc.update("INSERT INTO players(team_id,name,shirt_number,position,first_choice,active) VALUES (1,'활동 종료',99,'GK','GK',false)");
        Integer[][] expected = {{1, null, 11, 12, 13, 21, 22, 31, 32, 35, 2, 3},
                                {31, 32, 35, 21, 22, 11, 12, 13, 1, null, 2, 3}};
        String[] directions = {"asc", "desc"};
        for (int d = 0; d < directions.length; d++) {
            for (int page = 0; page < 3; page++) {
                var response = mvc.perform(get("/api/v1/players?sort=preferredPosition&direction=" + directions[d] + "&size=4&page=" + page))
                        .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(12))
                        .andExpect(jsonPath("$.totalPages").value(3)).andExpect(jsonPath("$.items.length()").value(4));
                for (int row = 0; row < 4; row++) {
                    var actual = jsonPath("$.items[" + row + "].shirtNumber");
                    Integer shirt = expected[d][page * 4 + row];
                    response.andExpect(shirt == null ? actual.isEmpty() : actual.value(shirt));
                }
            }
        }
    }

    @Test
    @WithMockUser(username = "test-member", roles = "MEMBER")
    void sortsTheEntireRosterBeforePagingAndKeepsUnknownValuesLast() throws Exception {
        jdbc.update("DELETE FROM players");
        // Insert in reverse order so that sorting only the current page would fail.
        for (int i = 31; i >= 1; i--) jdbc.update(
                "INSERT INTO players(team_id,name,shirt_number,position,birth_year,active) VALUES (1,?,?,'UN',?,true)",
                "가상선수%02d".formatted(i), i, 1990 + i);
        jdbc.update("INSERT INTO players(team_id,name,position,active) VALUES (1,'미확인선수','UN',true)");
        for (int size : new int[]{10, 20, 30}) {
            mvc.perform(get("/api/v1/players?size=" + size + "&sort=shirtNumber"))
                    .andExpect(jsonPath("$.items.length()").value(size))
                    .andExpect(jsonPath("$.items[0].shirtNumber").value(1))
                    .andExpect(jsonPath("$.items[" + (size - 1) + "].shirtNumber").value(size));
            mvc.perform(get("/api/v1/players?page=1&size=" + size + "&sort=shirtNumber"))
                    .andExpect(jsonPath("$.items[0].shirtNumber").value(size + 1));
        }
        for (String sort : new String[]{"shirtNumber", "age"}) {
            for (String direction : new String[]{"asc", "desc"}) {
                mvc.perform(get("/api/v1/players?page=3&size=10&sort=" + sort + "&direction=" + direction))
                        .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(32))
                        .andExpect(jsonPath("$.items[1].name").value("미확인선수"));
            }
        }
        mvc.perform(get("/api/v1/players?sort=shirtNumber&direction=desc"))
                .andExpect(jsonPath("$.items[0].shirtNumber").value(31));
        mvc.perform(get("/api/v1/players?sort=age&direction=asc"))
                .andExpect(jsonPath("$.items[0].birthYear").value(2021));
        mvc.perform(get("/api/v1/players?sort=age&direction=desc"))
                .andExpect(jsonPath("$.items[0].birthYear").value(1991));
        mvc.perform(get("/api/v1/players?sort=name"))
                .andExpect(jsonPath("$.items[0].name").value("가상선수01"));
        mvc.perform(get("/api/v1/players?sort=name&direction=desc"))
                .andExpect(jsonPath("$.items[0].name").value("미확인선수"));
        jdbc.update("UPDATE players SET birth_year=2000");
        Long firstId = jdbc.queryForObject("SELECT MIN(id) FROM players", Long.class);
        mvc.perform(get("/api/v1/players?size=1&sort=age&direction=desc"))
                .andExpect(jsonPath("$.items[0].id").value(firstId));
    }

    @Test
    @WithMockUser(username = "test-admin", roles = "DIRECTOR")
    void invalidClubRoleCannotBeSavedViaApiBulkOrSql() throws Exception {
        mvc.perform(post("/api/v1/players").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                {"name":"직책검증","position":"UN","clubRole":"골키퍼"}
                """)).andExpect(status().isBadRequest());
        long before = jdbc.queryForObject("SELECT COUNT(*) FROM players", Long.class);
        mvc.perform(post("/api/v1/players/bulk").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                {"rows":[{"name":"정상직책","position":"UN","clubRole":"정회원"},
                {"name":"잘못된직책","position":"UN","clubRole":"골키퍼"}]}
                """)).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM players", Long.class)).isEqualTo(before);
        assertThatThrownBy(() -> jdbc.update("UPDATE players SET club_role='골키퍼'"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE players SET club_role=NULL"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
    }

    @Test @WithMockUser(username = "test-admin", roles = "DIRECTOR")
    void activeShirtsAreUniqueWhileUnnumberedAndInactivePlayersAreAllowed() throws Exception {
        long existingId = jdbc.queryForObject("SELECT id FROM players WHERE shirt_number=7", Long.class);
        mvc.perform(post("/api/v1/players").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"name":"중복 등록","position":"UN","shirtNumber":7}
                """ )).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.shirtNumber").isNotEmpty());
        mvc.perform(put("/api/v1/players/" + existingId).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"name":"본인 번호 유지","position":"UN","shirtNumber":7,"version":0}
                """ )).andExpect(status().isOk()).andExpect(jsonPath("$.shirtNumber").value(7));
        mvc.perform(post("/api/v1/players").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"name":"종료 선수 번호 재사용","position":"UN","shirtNumber":9}
                """ )).andExpect(status().isCreated());
        mvc.perform(put("/api/v1/players/" + existingId).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"name":"중복 변경","position":"UN","shirtNumber":9,"version":1}
                """ )).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT shirt_number FROM players WHERE id=?", Integer.class, existingId)).isEqualTo(7);
        assertThatThrownBy(() -> jdbc.update("INSERT INTO players(team_id,name,position,shirt_number) VALUES (1,'DB 중복검증','UN',7)"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE players SET active=true WHERE active=false AND shirt_number=9"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
        jdbc.update("INSERT INTO players(team_id,name,position,shirt_number,active) VALUES (1,'종료 중복 허용','UN',7,false)");
        for (int i = 0; i < 2; i++) mvc.perform(post("/api/v1/players").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"name":"등번호 미등록","position":"UN","shirtNumber":null}
                """ )).andExpect(status().isCreated());
        mvc.perform(post("/api/v1/players").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"name":"영번 거부","position":"UN","shirtNumber":0}
                """ )).andExpect(status().isBadRequest());
        assertThatThrownBy(() -> jdbc.update("INSERT INTO players(team_id,name,position,shirt_number) VALUES (1,'영번 거부','UN',0)"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
    }

    @Test @WithMockUser(username = "test-admin", roles = "DIRECTOR")
    void bulkShirtCollisionsAreAtomicAndRecheckedAfterPreview() throws Exception {
        long before = jdbc.queryForObject("SELECT COUNT(*) FROM players", Long.class);
        for (String rows : java.util.List.of(
                """
                {"rows":[{"name":"검증 A","position":"UN","shirtNumber":"8"},{"name":"검증 B","position":"UN","shirtNumber":"08"}]}
                """,
                """
                {"rows":[{"name":"검증 A","position":"UN","shirtNumber":"8"},{"name":"검증 B","position":"UN","shirtNumber":"7"}]}
                """)) {
            mvc.perform(post("/api/v1/players/bulk/preview").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(rows))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.valid").value(false));
            mvc.perform(post("/api/v1/players/bulk").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(rows)).andExpect(status().isBadRequest());
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM players", Long.class)).isEqualTo(before);
        String initiallyFree = """
                {"rows":[{"name":"대기 중 선수","position":"UN","shirtNumber":"8"}]}
                """;
        mvc.perform(post("/api/v1/players/bulk/preview").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(initiallyFree))
                .andExpect(jsonPath("$.valid").value(true));
        jdbc.update("INSERT INTO players(team_id,name,position,shirt_number) VALUES (1,'먼저 저장한 선수','UN',8)");
        mvc.perform(post("/api/v1/players/bulk").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(initiallyFree)).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM players", Long.class)).isEqualTo(before + 1);
    }
}
