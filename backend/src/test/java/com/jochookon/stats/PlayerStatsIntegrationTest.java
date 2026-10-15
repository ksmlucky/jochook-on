package com.jochookon.stats;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jochookon.team.TeamContext;
import com.jochookon.team.TeamTestData;
import com.jochookon.match.Attendance;
import com.jochookon.match.Vote;
import com.jochookon.match.MatchKind;
import com.jochookon.match.MatchRequest;
import com.jochookon.match.RecordingStage;
import java.sql.Date;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;
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
    @Autowired ObjectMapper json;
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
        var details = details(a, today.getYear(), StatsMatchKind.INTERNAL, StatsRecordScope.COMPLETED, false, 0);
        assertThat(details.player()).isEqualTo(item(result, a));
        assertThat(details.totalElements()).isEqualTo(1);
        assertThat(details.items()).singleElement().satisfies(row -> {
            assertThat(row.matchId()).isEqualTo(game);
            assertThat(row.goals()).isEqualTo(2);
            assertThat(row.creditedQuarters()).isEqualTo(1.5);
            assertThat(row.appeared()).isTrue();
        });
        assertThat(details(b, today.getYear(), StatsMatchKind.INTERNAL, StatsRecordScope.COMPLETED, false, 0)
                .items()).singleElement().extracting(PlayerMatchStatsResponse.Item::creditedQuarters).isEqualTo(1.0);
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
        assertThat(details(p, today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0)
                .items()).singleElement().satisfies(row -> {
                    assertThat(row.goals()).isEqualTo(5);
                    assertThat(row.assists()).isEqualTo(1);
                    assertThat(row.attendance()).isEqualTo("LATE");
                });
        jdbc.update("UPDATE match_records SET recording_stage='ACTUAL' WHERE id=?", game);
        assertThat(item(read(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false), p).goals()).isZero();
        assertThat(item(read(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.ALL, false), p).goals()).isEqualTo(5);
        assertThat(details(p, today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0).items()).isEmpty();
        assertThat(details(p, today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.ALL, false, 0)
                .items()).singleElement().extracting(PlayerMatchStatsResponse.Item::recordingStage).isEqualTo("ACTUAL");
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
        var afterDelete = details(p, today.getYear(), StatsMatchKind.ALL, StatsRecordScope.ALL, true, 0);
        assertThat(afterDelete.player()).isEqualTo(item(empty, p));
        assertThat(afterDelete.totalElements()).isZero();
        assertThat(afterDelete.totalPages()).isZero();
        assertThat(afterDelete.items()).isEmpty();
    }

    @Test void detailIncludesAttendanceOnlyAndMissingAttendanceButNotPlansOrAbsenceOnlyAndKeepsGuestSubstitutionCredit() throws Exception {
        long member = player(1, 1, true, "MEMBER"), guest = player(1, null, true, "GUEST");
        long played = match(1, today, "EXTERNAL", "COMPLETED");
        jdbc.update("UPDATE match_records SET kickoff='11:30:00',opponent='가상 상대',venue='가상 구장',score_for=4,score_against=2 WHERE id=?", played);
        attendance(played, member, "LATE"); attendance(played, guest, "PRESENT");
        appearance(played, 1, "A", "ST", 0, member, 2, 1);
        appearance(played, 1, "A", "ST", 1, guest, 1, 0);
        appearance(played, 2, "A", "ST", 0, member, 1, 0);
        long presentOnly = match(1, today, "EXTERNAL", "COMPLETED");
        attendance(presentOnly, member, "PRESENT");
        long noAttendance = match(1, today, "EXTERNAL", "COMPLETED");
        jdbc.update("UPDATE match_records SET kickoff=NULL WHERE id=?", noAttendance);
        appearance(noAttendance, 1, "A", "LW", 0, member, 0, 0);
        long planOnly = match(1, today, "EXTERNAL", "COMPLETED");
        attendance(planOnly, member, "UNCONFIRMED");
        jdbc.update("INSERT INTO match_planned_lineups(match_id,quarter_number,team,slot,entry_order,player_id) VALUES (?,1,'A','ST',0,?)", planOnly, member);
        long absentOnly = match(1, today, "EXTERNAL", "COMPLETED");
        attendance(absentOnly, member, "ABSENT");
        var detail = details(member, today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0);
        assertThat(detail.player()).isEqualTo(item(read(today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false), member));
        assertThat(detail.totalElements()).isEqualTo(3);
        assertThat(detail.items()).extracting(PlayerMatchStatsResponse.Item::matchId).containsExactly(noAttendance, presentOnly, played);
        var originalTime = originalKickoff(played);
        assertThat(detail.items().get(2)).satisfies(row -> {
            assertThat(row.playedOn()).isEqualTo(today);
            assertThat(row.kickoff()).isEqualTo(originalTime);
            assertThat(row.opponent()).isEqualTo("가상 상대");
            assertThat(row.venue()).isEqualTo("가상 구장");
            assertThat(row.kind()).isEqualTo("EXTERNAL");
            assertThat(row.recordingStage()).isEqualTo("COMPLETED");
            assertThat(row.scoreFor()).isEqualTo(4);
            assertThat(row.scoreAgainst()).isEqualTo(2);
            assertThat(row.goals()).isEqualTo(3);
            assertThat(row.assists()).isEqualTo(1);
            assertThat(row.creditedQuarters()).isEqualTo(1.5);
            assertThat(row.appeared()).isTrue();
            assertThat(row.attendance()).isEqualTo("LATE");
        });
        assertThat(detail.items().get(1)).satisfies(row -> {
            assertThat(row.appeared()).isFalse();
            assertThat(row.attendance()).isEqualTo("PRESENT");
            assertThat(row.goals()).isZero();
            assertThat(row.assists()).isZero();
            assertThat(row.creditedQuarters()).isZero();
            assertThat(row.scoreFor()).isNull();
            assertThat(row.scoreAgainst()).isNull();
        });
        assertThat(detail.items().getFirst()).satisfies(row -> {
            assertThat(row.kickoff()).isNull();
            assertThat(row.attendance()).isNull();
            assertThat(row.appeared()).isTrue();
            assertThat(row.creditedQuarters()).isEqualTo(1);
        });
        var guestDetail = details(guest, today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, true, 0);
        assertThat(guestDetail.player().shirtNumber()).isNull();
        assertThat(guestDetail.items()).singleElement().satisfies(row -> assertThat(row.creditedQuarters()).isEqualTo(0.5));
        assertThat(detail.player().creditedQuarters()).isEqualTo(2.5);
        assertThat(detail.player().appearances()).isEqualTo(2);
        assertThat(detail.player().attendances()).isEqualTo(2);
    }

    @Test void everyFilterCombinationHasTheSameSummaryAndContributionSumsAsSeasonList() {
        long member = player(1, 1, true, "MEMBER"), guest = player(1, null, true, "GUEST");
        long inactive = player(1, 2, false, "MEMBER");
        for (String kind : List.of("EXTERNAL", "INTERNAL")) {
            for (String stage : new String[]{"COMPLETED", null, "ACTUAL"}) {
                long game = match(1, today, kind, stage);
                attendance(game, member, "LATE"); attendance(game, guest, "PRESENT"); attendance(game, inactive, "PRESENT");
                appearance(game, 1, "A", "ST", 0, member, 2, 1);
                appearance(game, 1, "A", "ST", 1, guest, 1, 2);
            }
        }
        long future = record(1, member, today.plusDays(1), "EXTERNAL", "COMPLETED", 90);
        long previousYear = record(1, member, LocalDate.of(today.getYear() - 1, 12, 31), "EXTERNAL", "COMPLETED", 80);
        for (StatsMatchKind kind : StatsMatchKind.values()) {
            for (StatsRecordScope scope : StatsRecordScope.values()) {
                for (boolean guests : new boolean[]{false, true}) {
                    var season = read(today.getYear(), kind, scope, guests);
                    for (var summary : season.items()) {
                        var detail = details(summary.playerId(), today.getYear(), kind, scope, guests, 0);
                        assertThat(detail.player()).isEqualTo(summary);
                        assertThat(detail.totalElements()).isEqualTo(detail.items().size());
                        assertThat(detail.items()).extracting(PlayerMatchStatsResponse.Item::matchId).doesNotContain(future, previousYear);
                        assertThat(detail.items().stream().mapToLong(PlayerMatchStatsResponse.Item::goals).sum()).isEqualTo(summary.goals());
                        assertThat(detail.items().stream().mapToLong(PlayerMatchStatsResponse.Item::assists).sum()).isEqualTo(summary.assists());
                        assertThat(detail.items().stream().mapToDouble(PlayerMatchStatsResponse.Item::creditedQuarters).sum()).isEqualTo(summary.creditedQuarters());
                        assertThat(detail.items().stream().filter(PlayerMatchStatsResponse.Item::appeared).count()).isEqualTo(summary.appearances());
                        assertThat(detail.items().stream().filter(row -> List.of("PRESENT", "LATE").contains(row.attendance())).count()).isEqualTo(summary.attendances());
                    }
                    if (!guests) assertThatThrownBy(() -> details(guest, today.getYear(), kind, scope, false, 0))
                            .isInstanceOf(PlayerStatsNotFoundException.class);
                }
            }
        }
        assertThat(details(member, today.getYear() - 1, StatsMatchKind.ALL, StatsRecordScope.ALL, false, 0)
                .items()).singleElement().extracting(PlayerMatchStatsResponse.Item::matchId).isEqualTo(previousYear);
        assertThat(details(member, 9999, StatsMatchKind.ALL, StatsRecordScope.ALL, true, 0).items()).isEmpty();
    }

    @Test void detailPaginatesByDateThenIdWithoutChangingTheFullSummary() {
        long player = player(1, 1, true, "MEMBER");
        int year = today.getYear() - 1;
        var day = LocalDate.of(year, 1, 2);
        var early = new ArrayList<Long>();
        var later = new ArrayList<Long>();
        for (int i = 0; i < 10; i++) early.add(record(1, player, day, "EXTERNAL", "COMPLETED", 1));
        // A later kickoff must not reorder same-date records away from the stable descending ID order.
        jdbc.update("UPDATE match_records SET kickoff='23:30:00' WHERE id=?", early.getFirst());
        for (int i = 0; i < 11; i++) {
            long game = record(1, player, day, "EXTERNAL", "COMPLETED", 1);
            jdbc.update("UPDATE match_records SET kickoff='11:30:00' WHERE id=?", game);
            later.add(game);
        }
        long oldest = record(1, player, day.minusDays(1), "EXTERNAL", "COMPLETED", 1);
        jdbc.update("UPDATE match_records SET kickoff='23:30:00' WHERE id=?", oldest);
        long newest = record(1, player, day.plusDays(1), "EXTERNAL", "COMPLETED", 1);
        jdbc.update("UPDATE match_records SET kickoff='00:00:00' WHERE id=?", newest);
        var expected = new ArrayList<Long>();
        expected.add(newest); Collections.reverse(later); expected.addAll(later);
        Collections.reverse(early); expected.addAll(early); expected.add(oldest);
        var actual = new ArrayList<Long>();
        var summary = item(read(year, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false), player);
        for (int page = 0; page < 4; page++) {
            var detail = details(player, year, StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, page);
            assertThat(detail.page()).isEqualTo(page);
            assertThat(detail.size()).isEqualTo(10);
            assertThat(detail.totalElements()).isEqualTo(23);
            assertThat(detail.totalPages()).isEqualTo(3);
            assertThat(detail.player()).isEqualTo(summary);
            assertThat(detail.items()).hasSize(page < 2 ? 10 : page == 2 ? 3 : 0);
            actual.addAll(detail.items().stream().map(PlayerMatchStatsResponse.Item::matchId).toList());
        }
        assertThat(actual).containsExactlyElementsOf(expected).doesNotHaveDuplicates();
        assertThat(summary.goals()).isEqualTo(23);
        assertThat(summary.appearances()).isEqualTo(23);
    }

    @Test void ormSavedKickoffsMatchOriginalAndDetailApisAfterFreshRequestsIncludingMidnight() throws Exception {
        long member = player(1, 1, true, "MEMBER");
        var savedIds = new ArrayList<Long>();
        for (var time : List.of(LocalTime.MIDNIGHT, LocalTime.of(8, 30), LocalTime.of(11, 0), LocalTime.of(23, 30))) {
            var input = new MatchRequest(today, time, "가상 구장", "가상 상대", "시간 매핑 검증", null,
                    List.of(new MatchRequest.Participant(member, Vote.ATTENDING, Attendance.PRESENT)),
                    List.of(new MatchRequest.Quarter(1, List.of()), new MatchRequest.Quarter(2, List.of()),
                            new MatchRequest.Quarter(3, List.of()), new MatchRequest.Quarter(4, List.of())),
                    List.of(), null, null, MatchKind.EXTERNAL, RecordingStage.COMPLETED);
            var created = mvc.perform(post("/api/v1/matches").header("X-Team-Id", "1").with(user("test-admin").roles("DIRECTOR"))
                            .with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                    .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
            long id = json.readTree(created).get("id").asLong();
            savedIds.add(id);
            // Separate HTTP requests force committed DB reads, rather than returning the entity just saved.
            assertThat(originalKickoff(id)).isEqualTo(time);
            var detail = mvc.perform(get("/api/v1/stats/players/" + member + "/matches").header("X-Team-Id", "1")
                            .with(user("test-member").roles("MEMBER")))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            var row = json.readTree(detail).get("items").get(0);
            assertThat(row.get("matchId").asLong()).isEqualTo(id);
            assertThat(LocalTime.parse(row.get("kickoff").asString())).isEqualTo(time);
        }
        Collections.reverse(savedIds);
        assertThat(details(member, today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, false, 0)
                .items()).extracting(PlayerMatchStatsResponse.Item::matchId).containsExactlyElementsOf(savedIds);
    }

    private LocalTime originalKickoff(long matchId) throws Exception {
        var response = mvc.perform(get("/api/v1/matches/" + matchId).header("X-Team-Id", "1")
                        .with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return LocalTime.parse(json.readTree(response).get("kickoff").asString());
    }

    @Test void filteredAndCrossTeamPlayersShareOne404WhileActiveZeroMembersHaveEmptyDetails() throws Exception {
        long active = player(1, 1, true, "MEMBER"), inactive = player(1, 2, false, "MEMBER");
        long guest = player(1, null, true, "GUEST"), other = player(2, 1, true, "MEMBER");
        long emptyGuest = player(1, null, true, "GUEST");
        long ownMatch = record(1, guest, today, "EXTERNAL", "COMPLETED", 1);
        attendance(ownMatch, other, "PRESENT"); appearance(ownMatch, 1, "A", "ST", 1, other, 90, 0);
        record(2, other, today, "EXTERNAL", "COMPLETED", 99);
        for (long id : new long[]{inactive, guest, other, emptyGuest, Long.MAX_VALUE}) {
            mvc.perform(get("/api/v1/stats/players/" + id + "/matches").header("X-Team-Id", "1")
                    .with(user("test-member").roles("MEMBER")))
                    .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("PLAYER_STATS_NOT_FOUND"))
                    .andExpect(jsonPath("$.message").value("현재 조건에서 선수 기록을 찾을 수 없습니다."));
        }
        var empty = details(active, today.getYear(), StatsMatchKind.ALL, StatsRecordScope.ALL, false, 0);
        assertThat(empty.player().goals()).isZero();
        assertThat(empty.totalElements()).isZero();
        assertThat(empty.items()).isEmpty();
        // Corrupt cross-team references never enter the substitution window or become visible in details.
        var guestDetail = details(guest, today.getYear(), StatsMatchKind.EXTERNAL, StatsRecordScope.COMPLETED, true, 0);
        assertThat(guestDetail.items()).singleElement().satisfies(row -> {
            assertThat(row.goals()).isEqualTo(1);
            assertThat(row.creditedQuarters()).isEqualTo(1);
        });
        assertThatThrownBy(() -> details(other, today.getYear(), StatsMatchKind.ALL, StatsRecordScope.ALL, true, 0))
                .isInstanceOf(PlayerStatsNotFoundException.class);
        assertThatThrownBy(() -> details(guest, today.getYear(), StatsMatchKind.INTERNAL, StatsRecordScope.COMPLETED, true, 0))
                .isInstanceOf(PlayerStatsNotFoundException.class);
        assertThatThrownBy(() -> details(emptyGuest, today.getYear(), StatsMatchKind.ALL, StatsRecordScope.ALL, true, 0))
                .isInstanceOf(PlayerStatsNotFoundException.class);
        mvc.perform(get("/api/v1/stats/players/" + guest + "/matches?includeGuests=true").header("X-Team-Id", "1")
                .with(user("test-member").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].matchId").value(ownMatch));
    }

    private PlayerMatchStatsResponse details(long playerId, int year, StatsMatchKind kind, StatsRecordScope scope,
                                             boolean guests, int page) {
        TeamContext.set(1);
        try { return stats.matches(playerId, year, kind, scope, guests, page); } finally { TeamContext.clear(); }
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
