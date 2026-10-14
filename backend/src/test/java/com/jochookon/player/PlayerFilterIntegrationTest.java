package com.jochookon.player;

import static com.jochookon.player.TeamScopedRequests.get;
import static org.hamcrest.Matchers.contains;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Year;
import java.time.ZoneId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

@Tag("integration")
@Testcontainers
@SpringBootTest(properties = {"spring.datasource.password=unused-test-password",
        "jochookon.bootstrap.admin.username=", "jochookon.bootstrap.admin.password=",
        "jochookon.bootstrap.service-admin-username="})
@AutoConfigureMockMvc
@WithMockUser(username = "test-member", roles = "MEMBER")
class PlayerFilterIntegrationTest {
    @Container
    @ServiceConnection
    static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");

    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;

    @BeforeEach
    void seedOnlyTheIsolatedTestDatabase() {
        com.jochookon.team.TeamTestData.seed(jdbc);
        jdbc.update("DELETE FROM players");
    }

    @ParameterizedTest
    @CsvSource({"UNDER_20,0,19", "20,20,29", "30,30,39", "40,40,49", "50,50,59",
            "60,60,69", "70,70,79", "80,80,89", "90,90,99", "100_PLUS,100,110"})
    void ageRangesUseCalendarYearsAndIncludeBothBoundaries(String ageGroup, int youngest, int oldest) throws Exception {
        int year = Year.now(ZoneId.of("Asia/Seoul")).getValue();
        insert(1, "범위 시작", 1, year - youngest, "정회원", "CM", true, "MEMBER");
        insert(1, "범위 끝", 2, year - oldest, "정회원", "CM", true, "MEMBER");
        insert(1, "더 어린 선수", 3, year - youngest + 1, "정회원", "CM", true, "MEMBER");
        if (!ageGroup.equals("100_PLUS")) {
            insert(1, "더 나이든 선수", 4, year - oldest - 1, "정회원", "CM", true, "MEMBER");
        }
        insert(1, "생년 미확인", 5, null, "정회원", "CM", true, "MEMBER");
        mvc.perform(get("/api/v1/players").param("ageGroup", ageGroup).param("sort", "shirtNumber"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.items[0].shirtNumber").value(1))
                .andExpect(jsonPath("$.items[1].shirtNumber").value(2));
    }

    @Test
    void unknownAgeAndFirstChoiceCanBeFilteredIndependentlyOrTogether() throws Exception {
        insert(1, "둘 다 미확인", 1, null, "정회원", null, true, "MEMBER");
        insert(1, "생년만 미확인", 2, null, "정회원", "CM", true, "MEMBER");
        insert(1, "포지션만 미확인", 3, 2000, "정회원", null, true, "MEMBER");
        insert(1, "모두 확인", 4, 2000, "정회원", "CM", true, "MEMBER");
        mvc.perform(get("/api/v1/players?ageGroup=UNKNOWN"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/v1/players?firstChoice=UNKNOWN"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/v1/players?ageGroup=UNKNOWN&firstChoice=UNKNOWN"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].shirtNumber").value(1));
    }

    @Test
    void filtersBeforeCountAndSortingAndKeepsInactiveGuestsAndOtherTeamsOut() throws Exception {
        int year = Year.now(ZoneId.of("Asia/Seoul")).getValue();
        jdbc.update("INSERT INTO teams (id, name, status) VALUES (2, '다른 검증 팀', 'ACTIVE') ON DUPLICATE KEY UPDATE status='ACTIVE'");
        for (int shirt : new int[]{9, 3, 7, 1, 5}) {
            insert(1, "검색 대상 " + shirt, shirt, year - 30, "코치", "CM", true, "MEMBER");
        }
        insert(1, "다른 나이", 11, year - 29, "코치", "CM", true, "MEMBER");
        insert(1, "다른 직책", 12, year - 30, "정회원", "CM", true, "MEMBER");
        insert(1, "다른 지망", 13, year - 30, "코치", "ST", true, "MEMBER");
        // 2지망이 CM이어도 1지망 필터에는 포함되지 않는다.
        jdbc.update("UPDATE players SET second_choice='CM' WHERE shirt_number=13 AND team_id=1");
        insert(1, "활동 종료", 14, year - 30, "코치", "CM", false, "MEMBER");
        insert(1, "용병", 15, year - 30, "코치", "CM", true, "GUEST");
        insert(2, "다른 팀 선수", 1, year - 30, "코치", "CM", true, "MEMBER");
        for (String direction : new String[]{"asc", "desc"}) {
            var result = mvc.perform(get("/api/v1/players").param("ageGroup", "30").param("clubRole", "코치")
                            .param("firstChoice", "CM").param("sort", "shirtNumber").param("direction", direction)
                            .param("size", "2").param("page", "1"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(5))
                    .andExpect(jsonPath("$.totalPages").value(3)).andExpect(jsonPath("$.items.length()").value(2))
                    .andExpect(jsonPath("$.items[0].shirtNumber").value(5));
            result.andExpect(jsonPath("$.items[1].shirtNumber").value(direction.equals("asc") ? 7 : 3));
        }
        mvc.perform(get("/api/v1/players").param("clubRole", "감독"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/players?ageGroup=&clubRole=&firstChoice="))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(8));
        mvc.perform(get("/api/v1/players/guests"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/players/guests").with(user("test-admin").roles("DIRECTOR")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.availableAgeGroups").isEmpty());
    }

    @ParameterizedTest
    @CsvSource({"FW,LW|ST|RW", "MF,CDM|CM", "DF,LB|CB|RB", "GK,GK"})
    void positionGroupIsDerivedOnlyFromFirstChoice(String group, String expected) throws Exception {
        String[] choices = {"GK", "LB", "CB", "RB", "CDM", "CM", "LW", "ST", "RW"};
        for (int i = 0; i < choices.length; i++) {
            insert(1, "포지션 검증 " + choices[i], i + 1, 2000, "정회원", choices[i], true, "MEMBER");
        }
        insert(1, "1지망 미확인", 10, 2000, "정회원", null, true, "MEMBER");
        // 과거 position 분류가 다르거나 2·3지망이 공격수여도 그룹은 오직 1지망으로 결정한다.
        jdbc.update("UPDATE players SET position='FW' WHERE team_id=1");
        jdbc.update("UPDATE players SET second_choice='ST', third_choice='LW' WHERE first_choice='GK'");
        String[] positions = expected.split("\\|");
        mvc.perform(get("/api/v1/players").param("positionGroup", group).param("sort", "shirtNumber"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(positions.length))
                .andExpect(jsonPath("$.items[*].firstChoice", contains(positions)));
    }

    @Test
    void groupFilteringKeepsPaginationAndLegacyFirstChoiceCanFurtherRestrictIt() throws Exception {
        insert(1, "왼쪽 공격", 3, 2000, "정회원", "LW", true, "MEMBER");
        insert(1, "중앙 공격", 1, 2000, "정회원", "ST", true, "MEMBER");
        insert(1, "오른쪽 공격", 2, 2000, "정회원", "RW", true, "MEMBER");
        insert(1, "미드필더", 4, 2000, "정회원", "CM", true, "MEMBER");
        insert(1, "미확인", 5, 2000, "정회원", null, true, "MEMBER");
        mvc.perform(get("/api/v1/players?positionGroup=FW&size=2&page=1&sort=shirtNumber"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2)).andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].firstChoice").value("LW"));
        mvc.perform(get("/api/v1/players?positionGroup=MF&firstChoice=CM"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/players?positionGroup=FW&firstChoice=CM"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/players?positionGroup=FW&firstChoice=UNKNOWN"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/players?positionGroup="))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(5));
    }

    @Test
    void availableAgeGroupsComeFromAllActiveMembersOfCurrentTeamRegardlessOfFiltersAndPage() throws Exception {
        int year = Year.now(ZoneId.of("Asia/Seoul")).getValue();
        int[] ages = {102, 66, 45, 35, 26, 8, 99, 28, 26};
        for (int i = 0; i < ages.length; i++) {
            insert(1, "연령대 검증 " + i, i + 1, year - ages[i], "코치", "CM", true, "MEMBER");
        }
        insert(1, "생년 미확인", 10, null, "정회원", "ST", true, "MEMBER");
        insert(1, "비활동 연령대", 11, year - 75, "정회원", "ST", false, "MEMBER");
        insert(1, "용병 연령대", 12, year - 85, "정회원", "ST", true, "GUEST");
        jdbc.update("INSERT INTO teams (id, name, status) VALUES (2, '다른 검증 팀', 'ACTIVE') ON DUPLICATE KEY UPDATE status='ACTIVE'");
        insert(2, "다른 팀 연령대", 1, year - 55, "정회원", "ST", true, "MEMBER");
        String[] expected = {"UNDER_20", "20", "30", "40", "60", "90", "100_PLUS", "UNKNOWN"};
        for (String query : new String[]{"size=1&page=0", "size=1&page=9",
                "ageGroup=30&clubRole=코치&positionGroup=MF", "ageGroup=50", "clubRole=감독"}) {
            mvc.perform(get("/api/v1/players?" + query)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.availableAgeGroups", contains(expected)));
        }
    }

    @Test
    void emptyRosterAndAbsentUnknownBirthYearDoNotInventAgeOptions() throws Exception {
        mvc.perform(get("/api/v1/players")).andExpect(status().isOk())
                .andExpect(jsonPath("$.availableAgeGroups").isEmpty());
        int year = Year.now(ZoneId.of("Asia/Seoul")).getValue();
        insert(1, "확인된 생년", 1, year - 36, "정회원", "CM", true, "MEMBER");
        mvc.perform(get("/api/v1/players?ageGroup=UNKNOWN")).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.availableAgeGroups", contains("30")));
    }

    private void insert(long teamId, String name, Integer shirt, Integer birthYear, String clubRole,
                        String firstChoice, boolean active, String type) {
        String position = firstChoice == null ? "UN" : switch (PreferredPosition.valueOf(firstChoice)) {
            case GK -> "GK";
            case LB, CB, RB -> "DF";
            case CDM, CM -> "MF";
            case LW, ST, RW -> "FW";
        };
        jdbc.update("""
                INSERT INTO players(team_id,name,shirt_number,birth_year,club_role,position,first_choice,active,player_type)
                VALUES (?,?,?,?,?,?,?,?,?)
                """, teamId, name, shirt, birthYear, clubRole, position, firstChoice, active, type);
    }
}
