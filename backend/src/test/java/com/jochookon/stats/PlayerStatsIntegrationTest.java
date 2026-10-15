package com.jochookon.stats;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jochookon.team.TeamContext;
import com.jochookon.team.TeamTestData;
import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

@Tag("integration") @Testcontainers
@SpringBootTest(properties = {"spring.datasource.password=unused-test-password",
        "jochookon.bootstrap.admin.username=", "jochookon.bootstrap.admin.password=",
        "jochookon.bootstrap.service-admin-username="})
@AutoConfigureMockMvc
class PlayerStatsIntegrationTest {
    @Container @ServiceConnection static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Autowired JdbcTemplate jdbc;
    @Autowired PlayerStatsService stats;
    @Autowired MockMvc mvc;
    final LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
    int sequence;

    @BeforeEach void seedOnlyTheDisposableContainerDatabase() {
        TeamContext.clear();
        TeamTestData.seed(jdbc);
        jdbc.update("INSERT INTO teams(id,name,status) VALUES (2,'통계 검증 타팀','ACTIVE') ON DUPLICATE KEY UPDATE status='ACTIVE'");
        for (String table : List.of("match_record_events", "match_planned_lineups", "match_appearances",
                "match_quarters", "match_participants", "match_records", "players")) jdbc.update("DELETE FROM " + table);
        sequence = 0;
    }
    @AfterEach void clearScope() { TeamContext.clear(); }

    @Test void sumsActualRecordsWithoutMultiplicationAndCreditsHalfQuarterSubstitutions() {
        long starter = player(1, 7, true, "MEMBER"), sub = player(1, 8, true, "MEMBER");
        long attendedOnly = player(1, 9, true, "MEMBER"), plannedOnly = player(1, 10, true, "MEMBER");
        long first = match(1, today, "EXTERNAL", "COMPLETED");
        attendance(first, starter, "PRESENT"); attendance(first, sub, "LATE");
        attendance(first, attendedOnly, "PRESENT"); attendance(first, plannedOnly, "UNCONFIRMED");
        appearance(first, 1, "A", "ST", 0, starter, 2, 1);
        appearance(first, 1, "A", "ST", 1, sub, 1, 0);
        appearance(first, 2, "A", "ST", 0, starter, 3, 0);
        appearance(first, 3, "A", "ST", 0, starter, 0, 0);
        jdbc.update("INSERT INTO match_planned_lineups(match_id,quarter_number,team,slot,entry_order,player_id) VALUES (?,4,'A','ST',0,?)", first, plannedOnly);
        long second = match(1, today, "EXTERNAL", "COMPLETED");
        attendance(second, starter, "LATE");
        appearance(second, 1, "A", "ST", 0, starter, 4, 2);

        var result = read(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false);
        assertThat(result.matchCount()).isEqualTo(2);
        var a = item(result, starter);
        assertThat(a.goals()).isEqualTo(9);
        assertThat(a.assists()).isEqualTo(3);
        assertThat(a.appearances()).isEqualTo(2);
        assertThat(a.attendances()).isEqualTo(2);
        assertThat(a.creditedQuarters()).isEqualTo(3.5);
        assertThat(item(result, sub).creditedQuarters()).isEqualTo(0.5);
        assertThat(item(result, sub).attendances()).isEqualTo(1);
        assertThat(item(result, attendedOnly).attendances()).isEqualTo(1);
        assertThat(item(result, attendedOnly).appearances()).isZero();
        assertThat(item(result, plannedOnly).creditedQuarters()).isZero();
        assertThat(item(result, plannedOnly).goals()).isZero();
        assertThat(item(result, plannedOnly).attendances()).isZero();
    }

    @Test void internalTeamsDoNotCountAsSubstitutionsAndSwitchingSidesIsStillOneAppearance() {
        long a = player(1, 1, true, "MEMBER"), sub = player(1, 2, true, "MEMBER"), b = player(1, 3, true, "MEMBER");
        long game = match(1, today, "INTERNAL", "COMPLETED");
        for (long p : new long[]{a, sub, b}) attendance(game, p, "PRESENT");
        appearance(game, 1, "A", "ST", 0, a, 1, 0);
        appearance(game, 1, "A", "ST", 1, sub, 0, 1);
        appearance(game, 1, "B", "ST", 0, b, 2, 0);
        appearance(game, 2, "B", "ST", 0, a, 1, 0);
        var result = read(today.getYear(), StatsMatchKind.INTERNAL, StatsRecordScope.COMPLETED, false);
        assertThat(item(result, a).creditedQuarters()).isEqualTo(1.5);
        assertThat(item(result, a).appearances()).isEqualTo(1);
        assertThat(item(result, a).goals()).isEqualTo(2);
        assertThat(item(result, sub).creditedQuarters()).isEqualTo(0.5);
        assertThat(item(result, b).creditedQuarters()).isEqualTo(1);
        assertThat(item(read(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false), a).goals()).isZero();
    }

    @Test void distinguishesCompletionLegacyAndInProgressAndExcludesFutureDatesAndOtherYears() {
        long p = player(1, 1, true, "MEMBER");
        record(1, p, today.withDayOfYear(1), "EXTERNAL", "COMPLETED", 1);
        record(1, p, today, "EXTERNAL", null, 2);
        record(1, p, today, "EXTERNAL", "ACTUAL", 4);
        record(1, p, today, "INTERNAL", "COMPLETED", 8);
        record(1, p, today.plusDays(1), "EXTERNAL", "COMPLETED", 16);
        record(1, p, LocalDate.of(today.getYear() - 1, 12, 31), "EXTERNAL", "COMPLETED", 32);
        var completed = read(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false);
        assertThat(completed.matchCount()).isEqualTo(1);
        assertThat(item(completed, p).goals()).isEqualTo(1);
        var recorded = read(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.RECORDED, false);
        assertThat(recorded.matchCount()).isEqualTo(2);
        assertThat(recorded.legacyMatchCount()).isEqualTo(1);
        assertThat(recorded.inProgressMatchCount()).isZero();
        assertThat(item(recorded, p).goals()).isEqualTo(3);
        var all = read(today.getYear(), StatsMatchKind.ALL, StatsRecordScope.ALL, false);
        assertThat(all.matchCount()).isEqualTo(4);
        assertThat(all.completedMatchCount()).isEqualTo(2);
        assertThat(all.legacyMatchCount()).isEqualTo(1);
        assertThat(all.inProgressMatchCount()).isEqualTo(1);
        assertThat(item(all, p).goals()).isEqualTo(15);
        assertThat(item(read(today.getYear() - 1, StatsMatchKind.ALL, StatsRecordScope.ALL, false), p).goals()).isEqualTo(32);
        assertThat(read(9999, StatsMatchKind.ALL, StatsRecordScope.ALL, false).matchCount()).isZero();
        assertThat(read(1000, StatsMatchKind.ALL, StatsRecordScope.ALL, false).matchCount()).isZero();
    }

    @Test void includesZeroActiveMembersAndRecordedInactiveMembersAndOptionallyGuests() {
        long activeZero = player(1, 1, true, "MEMBER");
        long inactiveRecorded = player(1, 2, false, "MEMBER");
        long inactiveAbsent = player(1, 3, false, "MEMBER");
        long guest = player(1, null, true, "GUEST"), guestZero = player(1, null, true, "GUEST");
        long game = match(1, today, "EXTERNAL", "COMPLETED");
        attendance(game, inactiveRecorded, "PRESENT");
        attendance(game, inactiveAbsent, "ABSENT");
        attendance(game, guest, "LATE");
        appearance(game, 1, "A", "ST", 0, guest, 2, 0);
        var members = read(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false);
        assertThat(members.items()).extracting(PlayerStatsResponse.Item::playerId).containsExactly(activeZero, inactiveRecorded);
        assertThat(item(members, activeZero).goals()).isZero();
        assertThat(item(members, inactiveRecorded).active()).isFalse();
        var withGuests = read(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, true);
        assertThat(withGuests.items()).extracting(PlayerStatsResponse.Item::playerId).containsExactly(activeZero, inactiveRecorded, guest);
        assertThat(item(withGuests, guest).shirtNumber()).isNull();
        assertThat(item(withGuests, guest).goals()).isEqualTo(2);
        assertThat(withGuests.matchCount()).isEqualTo(members.matchCount());
        assertThat(withGuests.items()).extracting(PlayerStatsResponse.Item::playerId).doesNotContain(inactiveAbsent, guestZero);
    }

    @Test void appliesTeamScopeToEveryJoinIncludingCorruptCrossTeamRowsAndAvailableYears() throws Exception {
        long own = player(1, 7, true, "MEMBER"), other = player(2, 7, true, "MEMBER");
        long ownGame = match(1, today, "EXTERNAL", "COMPLETED");
        attendance(ownGame, own, "PRESENT"); appearance(ownGame, 1, "A", "ST", 0, own, 1, 0);
        // Defensive query test: the domain rejects these references, but DB foreign keys alone do not.
        attendance(ownGame, other, "PRESENT"); appearance(ownGame, 1, "A", "LW", 0, other, 99, 0);
        record(2, own, today, "EXTERNAL", "COMPLETED", 70);
        record(2, other, LocalDate.of(today.getYear() - 3, 1, 1), "EXTERNAL", "COMPLETED", 80);
        record(1, own, LocalDate.of(today.getYear() + 1, 1, 1), "EXTERNAL", "COMPLETED", 90);
        var response = read(today.getYear(), StatsMatchKind.ALL, StatsRecordScope.ALL, true);
        assertThat(response.items()).extracting(PlayerStatsResponse.Item::playerId).containsExactly(own);
        assertThat(item(response, own).goals()).isEqualTo(1);
        assertThat(response.matchCount()).isEqualTo(1);
        assertThat(response.availableYears()).containsExactly(today.getYear());
        mvc.perform(get("/api/v1/stats/players").header("X-Team-Id", "1").with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].playerId").value(own)).andExpect(jsonPath("$.items[0].goals").value(1));
        mvc.perform(get("/api/v1/stats/players").header("X-Team-Id", "2").with(user("test-member").roles("MEMBER")))
                .andExpect(status().isConflict());
    }

    @Test void changesAndDeletesImmediatelyRecalculateAndEmptySeasonsAreWellDefined() {
        long p = player(1, 1, true, "MEMBER");
        long game = record(1, p, today, "EXTERNAL", "COMPLETED", 2);
        assertThat(item(read(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false), p).goals()).isEqualTo(2);
        jdbc.update("UPDATE match_appearances SET goals=5,assists=1 WHERE match_id=?", game);
        jdbc.update("UPDATE match_participants SET attendance='LATE' WHERE match_id=?", game);
        var changed = read(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false);
        assertThat(item(changed, p).goals()).isEqualTo(5);
        assertThat(item(changed, p).assists()).isEqualTo(1);
        assertThat(item(changed, p).attendances()).isEqualTo(1);
        jdbc.update("UPDATE match_records SET recording_stage='ACTUAL' WHERE id=?", game);
        assertThat(item(read(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false), p).goals()).isZero();
        assertThat(item(read(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.ALL, false), p).goals()).isEqualTo(5);
        jdbc.update("DELETE FROM match_appearances WHERE match_id=?", game);
        jdbc.update("DELETE FROM match_participants WHERE match_id=?", game);
        jdbc.update("DELETE FROM match_records WHERE id=?", game);
        var empty = read(today.getYear(), StatsMatchKind.ALL, StatsRecordScope.ALL, true);
        assertThat(empty.matchCount()).isZero();
        assertThat(empty.completedMatchCount()).isZero();
        assertThat(empty.legacyMatchCount()).isZero();
        assertThat(empty.inProgressMatchCount()).isZero();
        assertThat(empty.availableYears()).containsExactly(today.getYear());
        assertThat(item(empty, p).goals()).isZero();
        assertThat(item(empty, p).appearances()).isZero();
        assertThat(item(empty, p).creditedQuarters()).isZero();
    }

    private PlayerStatsResponse read(int year, StatsMatchKind kind, StatsRecordScope scope, boolean guests) {
        TeamContext.set(1);
        try { return stats.list(year, kind, scope, guests); } finally { TeamContext.clear(); }
    }
    private PlayerStatsResponse.Item item(PlayerStatsResponse response, long id) {
        return response.items().stream().filter(p -> p.playerId() == id).findFirst().orElseThrow();
    }
    private long player(long team, Integer shirt, boolean active, String type) {
        String name = "통계 가상 선수 " + ++sequence;
        jdbc.update("INSERT INTO players(team_id,name,shirt_number,position,first_choice,birth_year,active,player_type) VALUES (?,?,?,'MF','CM',2000,?,?)",
                team, name, shirt, active, type);
        return jdbc.queryForObject("SELECT id FROM players WHERE team_id=? AND name=?", Long.class, team, name);
    }
    private long match(long team, LocalDate date, String kind, String stage) {
        String marker = "통계 가상 경기 " + ++sequence;
        jdbc.update("INSERT INTO match_records(team_id,played_on,kickoff,venue,opponent,notes,match_kind,recording_stage) VALUES (?,?,'10:00:00','','',?,?,?)",
                team, Date.valueOf(date), marker, kind, stage);
        return jdbc.queryForObject("SELECT id FROM match_records WHERE team_id=? AND notes=?", Long.class, team, marker);
    }
    private void attendance(long match, long player, String status) {
        jdbc.update("INSERT INTO match_participants(match_id,player_id,vote,attendance) VALUES (?,?,'ATTENDING',?)", match, player, status);
    }
    private void appearance(long match, int quarter, String team, String slot, int order, long player, int goals, int assists) {
        jdbc.update("INSERT INTO match_appearances(match_id,quarter_number,team,slot,entry_order,player_id,goals,assists) VALUES (?,?,?,?,?,?,?,?)",
                match, quarter, team, slot, order, player, goals, assists);
    }
    private long record(long team, long player, LocalDate date, String kind, String stage, int goals) {
        long game = match(team, date, kind, stage);
        attendance(game, player, "PRESENT");
        appearance(game, 1, "A", "ST", 0, player, goals, 0);
        return game;
    }
}
