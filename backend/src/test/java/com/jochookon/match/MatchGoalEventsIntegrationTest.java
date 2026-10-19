package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import com.jochookon.stats.*;
import com.jochookon.team.TeamContext;
import com.jochookon.team.TeamTestData;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.mysql.MySQLContainer;

@Tag("integration") @Testcontainers
@SpringBootTest(properties = {"spring.datasource.password=unused-test-password", "jochookon.bootstrap.admin.username=",
        "jochookon.bootstrap.admin.password=", "jochookon.bootstrap.service-admin-username="})
@WithMockUser(username = "test-admin", roles = "DIRECTOR")
class MatchGoalEventsIntegrationTest {
    @Container @ServiceConnection static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Autowired JdbcTemplate jdbc;
    @Autowired MatchService matches;
    @Autowired MatchHistoryService history;
    @Autowired PlayerStatsService stats;
    long scorer, helper;
    final LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));

    @BeforeEach void seed() {
        TeamContext.clear(); TeamTestData.seed(jdbc);
        for (String table : List.of("match_record_events", "match_goal_events", "match_planned_lineups", "match_appearances",
                "match_quarters", "match_participants", "match_records", "players")) jdbc.update("DELETE FROM " + table);
        jdbc.update("INSERT INTO players(team_id,name,position,first_choice,shirt_number) VALUES (1,'가상 득점 선수','FW','ST',1),(1,'가상 도움 선수','FW','LW',2)");
        scorer = jdbc.queryForObject("SELECT id FROM players WHERE shirt_number=1", Long.class);
        helper = jdbc.queryForObject("SELECT id FROM players WHERE shirt_number=2", Long.class);
        TeamContext.set(1);
    }
    @AfterEach void clearScope() { TeamContext.clear(); }
    private MatchRequest input(Long version, List<MatchRequest.GoalEvent> events, boolean completed) {
        return new MatchRequest(today, LocalTime.of(11, 0), "가상 구장", "가상 상대", "", version,
                List.of(new MatchRequest.Participant(scorer, Vote.ATTENDING, Attendance.PRESENT),
                        new MatchRequest.Participant(helper, Vote.ATTENDING, Attendance.PRESENT)),
                List.of(new MatchRequest.Quarter(1, List.of(new MatchRequest.Appearance(LineupSlot.ST, scorer, 0, 0, 0),
                        new MatchRequest.Appearance(LineupSlot.LW, helper, 0, 0, 0)), events),
                        new MatchRequest.Quarter(2, List.of(), List.of())), List.of(), 2, 0, MatchKind.EXTERNAL,
                completed ? RecordingStage.COMPLETED : RecordingStage.RESULT, Formation.F4123, Formation.F4123,
                null, null, null, MatchFormat.TWO_HALVES_30);
    }
    private MatchRequest.GoalEvent goal(Long assist, GoalType type) {
        return new MatchRequest.GoalEvent(scorer, assist, type, MatchTeam.A);
    }
    @Test void eventOrderSurvivesReloadAndCompletedStatsHistoryAndDeleteStayConsistent() {
        var events = List.of(goal(helper, GoalType.NORMAL), goal(null, GoalType.FREE_KICK));
        var saved = matches.create(input(null, events, true));
        var loaded = matches.get(saved.id());
        assertThat(loaded.quarters().getFirst().goalEvents()).containsExactlyElementsOf(events);
        assertThat(loaded.quarters().get(1).goalEvents()).isEmpty();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_quarters WHERE goal_events_linked=TRUE", Integer.class)).isEqualTo(2);
        var season = stats.list(today.getYear(), StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false);
        assertThat(season.items()).filteredOn(i -> i.playerId() == scorer).singleElement().satisfies(i -> {
            assertThat(i.goals()).isEqualTo(2); assertThat(i.freeKickGoals()).isEqualTo(1); assertThat(i.creditedQuarters()).isEqualTo(1);
        });
        assertThat(season.items()).filteredOn(i -> i.playerId() == helper).singleElement().satisfies(i -> assertThat(i.assists()).isEqualTo(1));
        var createdEvent = history.get(history.list(0, 10, saved.id()).items().getFirst().id());
        assertThat(createdEvent.after().quarters().getFirst().goalEvents()).containsExactlyElementsOf(events);
        var updated = matches.update(saved.id(), input(saved.version(), List.of(goal(null, GoalType.PENALTY)), true));
        assertThat(matches.get(saved.id()).quarters().getFirst().goalEvents()).hasSize(1);
        var updatedSeason = stats.list(today.getYear(), StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false);
        assertThat(updatedSeason.items()).filteredOn(i -> i.playerId() == scorer).singleElement().satisfies(i -> {
            assertThat(i.goals()).isEqualTo(1); assertThat(i.freeKickGoals()).isZero(); assertThat(i.penaltyGoals()).isEqualTo(1);
        });
        assertThat(updatedSeason.items()).filteredOn(i -> i.playerId() == helper).singleElement().satisfies(i -> assertThat(i.assists()).isZero());
        matches.delete(saved.id(), updated.version());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_goal_events", Integer.class)).isZero();
        var deleted = history.get(history.list(0, 10, saved.id()).items().getFirst().id());
        assertThat(deleted.before().quarters().getFirst().goalEvents()).containsExactly(goal(null, GoalType.PENALTY));
    }
    @Test void draftExcludedUntilCompletedAndEmptyModeRemainsLinkedAfterReload() {
        var draft = matches.create(input(null, List.of(goal(helper, GoalType.NORMAL)), false));
        assertThat(stats.list(today.getYear(), StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false).matchCount()).isZero();
        var saved = matches.update(draft.id(), input(draft.version(), List.of(), true));
        assertThat(matches.get(saved.id()).quarters().getFirst().goalEvents()).isEmpty();
        assertThat(stats.list(today.getYear(), StatsMatchKind.ALL, StatsRecordScope.COMPLETED, false).matchCount()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT SUM(goals) FROM match_appearances", Integer.class)).isZero();
    }
    @Test void invalidEventRollsBackEverythingAndCrossTeamReadsAreScoped() {
        var saved = matches.create(input(null, List.of(goal(helper, GoalType.NORMAL)), true));
        assertThatThrownBy(() -> matches.update(saved.id(), input(saved.version(), List.of(goal(scorer, GoalType.NORMAL)), true)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(matches.get(saved.id()).version()).isEqualTo(saved.version());
        assertThat(history.list(0, 10, saved.id()).totalElements()).isEqualTo(1);
        TeamContext.set(2);
        assertThatThrownBy(() -> matches.get(saved.id())).isInstanceOf(MatchNotFoundException.class);
    }
}
