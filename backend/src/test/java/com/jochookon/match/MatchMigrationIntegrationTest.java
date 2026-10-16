package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.mysql.MySQLContainer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Tag("integration") @Testcontainers
class MatchMigrationIntegrationTest {
    @Container static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @BeforeEach void resetOnlyTheTestcontainerSchema() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
                .cleanDisabled(false).load().clean();
    }
    @Test void v28AddsFourQuarterDefaultWithoutTruncatingExistingTournamentLeagueOrInternalRecords() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("27").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()));
        jdbc.update("INSERT INTO players(id,team_id,name,position) VALUES (1,1,'경기 형식 이전 검증','FW')");
        jdbc.update("INSERT INTO tournaments(id,team_id,name,start_date,end_date) VALUES (1,1,'기존 4쿼터 대회','2026-10-01','2026-10-31')");
        jdbc.update("INSERT INTO match_records(id,team_id,version,played_on,kickoff,venue,opponent,notes,match_kind,tournament_id) VALUES (1,1,5,'2026-10-15','11:00:00','','','리그 원본','EXTERNAL',NULL),(2,1,8,'2026-10-15','11:00:00','','','대회 원본','EXTERNAL',1),(3,1,3,'2026-10-15','11:00:00','','','자체전 원본','INTERNAL',NULL)");
        for (int match = 1; match <= 3; match++) {
            jdbc.update("INSERT INTO match_participants(match_id,player_id,vote,attendance) VALUES (?,1,'ATTENDING','PRESENT')", match);
            for (int q = 1; q <= 4; q++) jdbc.update("INSERT INTO match_quarters VALUES (?,?)", match, q);
            jdbc.update("INSERT INTO match_planned_lineups(match_id,quarter_number,team,slot,entry_order,player_id) VALUES (?,4,'A','ST',0,1)", match);
            jdbc.update("INSERT INTO match_appearances(match_id,quarter_number,team,slot,entry_order,player_id,goals,assists,free_kick_goals,penalty_goals) VALUES (?,4,'A','ST',0,1,3,1,1,1)", match);
        }
        jdbc.update("INSERT INTO match_save_requests(team_id,actor_account_id,request_key,request_method,request_fingerprint,match_id,result_version,completed_at) VALUES (1,1,'00000000-0000-0000-0000-000000000028','POST',?,2,8,'2026-10-15 01:00:00')", "c".repeat(64));
        var tables = List.of("players", "tournaments", "match_records", "match_participants", "match_quarters", "match_appearances", "match_planned_lineups", "match_save_requests");
        Map<String, List<Map<String, Object>>> before = new LinkedHashMap<>();
        for (var table : tables) before.put(table, jdbc.queryForList("SELECT * FROM " + table));
        var checksums = jdbc.queryForList("SELECT version,checksum FROM flyway_schema_history ORDER BY installed_rank");
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("28").load().migrate();
        for (var table : tables) {
            var after = jdbc.queryForList("SELECT * FROM " + table); after.forEach(row -> row.remove("match_format"));
            assertThat(after).as(table).containsExactlyInAnyOrderElementsOf(before.get(table));
        }
        assertThat(jdbc.queryForList("SELECT match_format FROM match_records ORDER BY id", String.class)).containsExactly("FOUR_QUARTERS", "FOUR_QUARTERS", "FOUR_QUARTERS");
        assertThat(jdbc.queryForList("SELECT version,checksum FROM flyway_schema_history WHERE version<>'28' ORDER BY installed_rank")).isEqualTo(checksums);
        assertThatThrownBy(() -> jdbc.update("UPDATE match_records SET match_format='TWO_HALVES_30' WHERE id=3"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
    }
    @Test void upgradesExistingV4LineupsToStartersWithoutChangingStats() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("4").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()));
        jdbc.update("INSERT INTO players(id,name,position) VALUES (1,'마이그레이션 검증','FW')");
        jdbc.update("INSERT INTO match_records(id,played_on,venue,opponent,notes) VALUES (1,'2026-10-13','','','')");
        jdbc.update("INSERT INTO match_records(id,played_on,kickoff,venue,opponent,notes) VALUES (2,'2026-10-13','11:15:00','','','')");
        jdbc.update("INSERT INTO match_participants VALUES (1,1,'ATTENDING','PRESENT')");
        jdbc.update("INSERT INTO match_quarters VALUES (1,1,30)");
        jdbc.update("INSERT INTO match_appearances VALUES (1,1,'ST',1,2,0)");
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("12").load().migrate();
        jdbc.update("INSERT INTO match_planned_lineups VALUES (1,1,'ST',0,1)");
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).load().migrate();
        assertThat(jdbc.queryForObject("SELECT team FROM match_appearances", String.class)).isEqualTo("A");
        assertThat(jdbc.queryForObject("SELECT team FROM match_planned_lineups", String.class)).isEqualTo("A");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records WHERE match_kind='EXTERNAL'", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT entry_order FROM match_appearances", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT goals FROM match_appearances", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT player_type FROM players WHERE id=1", String.class)).isEqualTo("MEMBER");
        assertThat(jdbc.queryForObject("SELECT kickoff FROM match_records WHERE id=1", java.sql.Time.class)).isNull();
        assertThat(jdbc.queryForObject("SELECT kickoff FROM match_records WHERE id=2", java.sql.Time.class).toLocalTime()).isEqualTo(java.time.LocalTime.of(11, 15));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records WHERE score_for IS NULL AND score_against IS NULL", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records WHERE recording_stage IS NULL", Integer.class)).isEqualTo(2);
        assertThatThrownBy(() -> jdbc.update("UPDATE match_records SET recording_stage='INVALID' WHERE id=1"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_quarters", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='match_quarters' AND column_name='duration_minutes'", Integer.class)).isZero();
    }

    @Test void upgradesV13ToTeamOwnershipWithoutChangingExistingIdsAccountsOrMatchRelations() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("13").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()));
        String hash = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(4).encode("isolated-migration-test-password");
        jdbc.update("INSERT INTO accounts(id,username,password_hash,role) VALUES (101,'legacy-admin',?,'ADMIN'),(102,'legacy-member',?,'MEMBER')", hash, hash);
        for (int i = 1; i <= 37; i++) jdbc.update(
                "INSERT INTO players(id,name,shirt_number,position,birth_year,joined_on,first_choice) VALUES (?, ?, ?, 'MF',1996,'2025-03-01','CM')",
                1000 + i, "이전 검증 선수 " + i, i);
        jdbc.update("INSERT INTO match_records(id,played_on,kickoff,venue,opponent,notes,match_kind,score_for,score_against) VALUES (201,'2026-10-04','11:00:00','가상 구장','가상 상대','보존할 코멘트','EXTERNAL',2,1),(202,'2026-10-11','11:30:00','','','자체전 보존','INTERNAL',3,2)");
        jdbc.update("INSERT INTO match_participants(match_id,player_id,vote,attendance) VALUES (201,1001,'ATTENDING','PRESENT'),(201,1002,'ATTENDING','LATE'),(202,1001,'ATTENDING','PRESENT'),(202,1002,'ATTENDING','PRESENT')");
        for (long matchId : List.of(201L, 202L)) for (int quarter = 1; quarter <= 4; quarter++)
            jdbc.update("INSERT INTO match_quarters(match_id,quarter_number) VALUES (?,?)", matchId, quarter);
        jdbc.update("INSERT INTO match_planned_lineups(match_id,quarter_number,slot,entry_order,player_id,team) VALUES (201,1,'ST',0,1001,'A'),(202,1,'ST',0,1001,'A'),(202,1,'ST',0,1002,'B')");
        jdbc.update("INSERT INTO match_appearances(match_id,quarter_number,slot,player_id,goals,assists,entry_order,team) VALUES (201,1,'ST',1001,2,0,0,'A'),(202,1,'ST',1001,3,0,0,'A'),(202,1,'ST',1002,2,0,0,'B')");
        var tables = List.of("accounts", "players", "match_records", "match_participants", "match_quarters", "match_planned_lineups", "match_appearances");
        Map<String, List<Map<String, Object>>> before = new LinkedHashMap<>();
        for (String table : tables) before.put(table, jdbc.queryForList("SELECT * FROM " + table));

        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).load().migrate();

        for (String table : tables) {
            var after = jdbc.queryForList("SELECT * FROM " + table);
            after.forEach(row -> { row.remove("team_id"); row.remove("service_admin"); row.remove("recording_stage"); row.remove("formation_a"); row.remove("formation_b"); row.remove("tournament_id"); row.remove("tournament_stage"); row.remove("free_kick_goals"); row.remove("penalty_goals"); row.remove("planned_team"); row.remove("match_format"); });
            assertThat(after).as("existing values in %s", table).containsExactlyInAnyOrderElementsOf(before.get(table));
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM teams WHERE id=1 AND name='HANA FC' AND status='ACTIVE'", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM players WHERE team_id=1", Integer.class)).isEqualTo(37);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_records WHERE team_id=1", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForList("SELECT CONCAT(account_id, ':', role) FROM team_memberships WHERE team_id=1 ORDER BY account_id", String.class))
                .containsExactly("101:COACH", "102:MEMBER");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM accounts WHERE service_admin=true", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_appearances WHERE match_id=202 AND team='B'", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM flyway_schema_history WHERE version IN ('14','15') AND success=true", Integer.class)).isEqualTo(2);
    }
    @Test void upgradesV20WithoutLosingLineupsAndSupportsNewSlotsAndPreferences() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("20").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()));
        jdbc.update("INSERT INTO players(id,team_id,name,position,first_choice) VALUES (1,1,'포메이션 검증','MF','CM')");
        jdbc.update("INSERT INTO match_records(id,team_id,played_on,kickoff,venue,opponent,notes,match_kind,recording_stage) VALUES (1,1,'2026-10-15','11:00:00','','','','INTERNAL','ACTUAL')");
        jdbc.update("INSERT INTO match_participants VALUES (1,1,'ATTENDING','PRESENT')");
        jdbc.update("INSERT INTO match_quarters VALUES (1,1)");
        jdbc.update("INSERT INTO match_appearances(match_id,quarter_number,slot,player_id,goals,assists,entry_order,team) VALUES (1,1,'LCM',1,2,1,0,'A')");
        jdbc.update("INSERT INTO match_planned_lineups(match_id,quarter_number,slot,player_id,entry_order,team) VALUES (1,1,'LCM',1,0,'A')");
        var beforeActual = jdbc.queryForList("SELECT * FROM match_appearances");
        var beforePlan = jdbc.queryForList("SELECT * FROM match_planned_lineups");
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).load().migrate();
        assertThat(jdbc.queryForObject("SELECT CONCAT(formation_a,':',formation_b) FROM match_records WHERE id=1", String.class)).isEqualTo("F4123:F4123");
        var afterActual = jdbc.queryForList("SELECT * FROM match_appearances");
        afterActual.forEach(row -> { row.remove("free_kick_goals"); row.remove("penalty_goals"); });
        assertThat(afterActual).isEqualTo(beforeActual);
        assertThat(jdbc.queryForList("SELECT * FROM match_planned_lineups")).isEqualTo(beforePlan);
        jdbc.update("UPDATE match_records SET formation_a='F4231',formation_b='F442' WHERE id=1");
        jdbc.update("UPDATE match_appearances SET slot='LCDM' WHERE match_id=1");
        jdbc.update("UPDATE match_planned_lineups SET slot='RCDM' WHERE match_id=1");
        jdbc.update("UPDATE players SET first_choice='LM',second_choice='RM',third_choice='CAM' WHERE id=1");
        assertThat(jdbc.queryForObject("SELECT slot FROM match_appearances", String.class)).isEqualTo("LCDM");
        assertThatThrownBy(() -> jdbc.update("UPDATE match_records SET match_kind='EXTERNAL' WHERE id=1"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE match_records SET formation_a='F999' WHERE id=1"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE match_appearances SET slot='FAKE' WHERE match_id=1"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
    }
    @Test void upgradesV21PreservingExistingFormationsStatsPreferencesAndMigrationChecksum() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("21").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()));
        jdbc.update("INSERT INTO players(id,team_id,name,position,first_choice) VALUES (1,1,'기존 선발 검증','FW','ST'),(2,1,'기존 교체 검증','MF','LM'),(3,1,'기존 상대 검증','MF','CDM')");
        jdbc.update("INSERT INTO match_records(id,team_id,played_on,kickoff,venue,opponent,notes,match_kind,recording_stage,formation_a,formation_b,score_for,score_against) VALUES (1,1,'2026-10-14','11:00:00','','','보존 검증','INTERNAL','COMPLETED','F442','F4231',3,1)");
        for (int player = 1; player <= 3; player++) jdbc.update("INSERT INTO match_participants VALUES (1,?,'ATTENDING','PRESENT')", player);
        for (int quarter = 1; quarter <= 4; quarter++) jdbc.update("INSERT INTO match_quarters VALUES (1,?)", quarter);
        jdbc.update("INSERT INTO match_appearances(match_id,quarter_number,slot,player_id,goals,assists,entry_order,team) VALUES (1,1,'LST',1,2,1,0,'A'),(1,1,'LST',2,1,0,1,'A'),(1,1,'LCDM',3,1,0,0,'B')");
        jdbc.update("INSERT INTO match_planned_lineups(match_id,quarter_number,slot,player_id,entry_order,team) VALUES (1,1,'LST',1,0,'A'),(1,1,'LST',2,1,'A'),(1,1,'LCDM',3,0,'B')");
        var tables = List.of("players", "match_records", "match_participants", "match_quarters", "match_appearances", "match_planned_lineups");
        Map<String, List<Map<String, Object>>> before = new LinkedHashMap<>();
        for (var table : tables) before.put(table, jdbc.queryForList("SELECT * FROM " + table));
        var checksum = jdbc.queryForObject("SELECT checksum FROM flyway_schema_history WHERE version='21'", Integer.class);

        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).load().migrate();

        for (var table : tables) {
            var after = jdbc.queryForList("SELECT * FROM " + table);
            after.forEach(row -> { row.remove("tournament_id"); row.remove("tournament_stage"); row.remove("free_kick_goals"); row.remove("penalty_goals"); row.remove("planned_team"); row.remove("match_format"); });
            assertThat(after).as("V22 and later preserve every existing value in %s", table).containsExactlyInAnyOrderElementsOf(before.get(table));
        }
        assertThat(jdbc.queryForObject("SELECT checksum FROM flyway_schema_history WHERE version='21'", Integer.class)).isEqualTo(checksum);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM flyway_schema_history WHERE version='22' AND success=true", Integer.class)).isEqualTo(1);
        jdbc.update("UPDATE match_records SET formation_a='F352',formation_b='F343' WHERE id=1");
        jdbc.update("UPDATE match_appearances SET slot=CASE WHEN team='A' THEN 'CCB' ELSE 'LWB' END WHERE match_id=1");
        jdbc.update("UPDATE match_planned_lineups SET slot=CASE WHEN team='A' THEN 'CCB' ELSE 'RWB' END WHERE match_id=1");
        jdbc.update("UPDATE players SET first_choice='LWB',second_choice='RWB',third_choice='LB',position='DF' WHERE id=2");
        assertThat(jdbc.queryForObject("SELECT SUM(goals) FROM match_appearances", Integer.class)).isEqualTo(4);
        assertThat(jdbc.queryForObject("SELECT SUM(assists) FROM match_appearances", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM match_appearances WHERE slot='CCB'", Integer.class)).isEqualTo(2);
        assertThatThrownBy(() -> jdbc.update("UPDATE match_records SET match_kind='EXTERNAL' WHERE id=1"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE match_records SET formation_a='F532' WHERE id=1"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE match_planned_lineups SET slot='FAKE' WHERE match_id=1"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
    }
    @Test void upgradesV25ThreeBackSlotsAndInfersOnlyUnambiguousPlansWithoutChangingStatsOrHistory() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("25").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()));
        for (int id = 1; id <= 7; id++) jdbc.update("INSERT INTO players(id,team_id,name,position) VALUES (?,1,?,'MF')", id, "팀 배정 이전 검증 " + id);
        jdbc.update("INSERT INTO match_records(id,team_id,version,played_on,kickoff,venue,opponent,notes,match_kind,formation_a,formation_b) VALUES (1,1,3,'2026-10-15','11:00:00','','','','INTERNAL','F352','F343'),(2,1,2,'2026-10-14','11:00:00','','','','EXTERNAL','F352','F4123')");
        for (int id = 1; id <= 7; id++) jdbc.update("INSERT INTO match_participants(match_id,player_id,vote,attendance) VALUES (?,?,'ATTENDING','PRESENT')", id == 7 ? 2 : 1, id);
        for (int match = 1; match <= 2; match++) for (int q = 1; q <= 4; q++) jdbc.update("INSERT INTO match_quarters VALUES (?,?)", match, q);
        jdbc.update("INSERT INTO match_planned_lineups(match_id,quarter_number,team,slot,entry_order,player_id) VALUES (1,1,'A','CDM',0,1),(1,1,'A','CDM',1,2),(1,1,'B','LWB',0,3),(1,1,'B','RWB',0,4),(1,2,'A','LCM',0,5),(1,3,'B','LCM',0,5),(2,1,'A','CDM',0,7)");
        jdbc.update("INSERT INTO match_appearances(match_id,quarter_number,team,slot,entry_order,player_id,goals,assists,free_kick_goals,penalty_goals) VALUES (1,1,'A','CDM',0,1,2,0,1,1),(1,1,'A','CDM',1,2,1,1,0,0),(1,1,'B','LWB',0,3,1,0,0,1),(1,1,'B','RWB',0,4,0,1,0,0),(2,1,'A','CDM',0,7,1,0,1,0)");
        String snapshot = "{\"formationA\":\"F352\",\"plannedLineup\":[{\"slot\":\"CDM\"}]}";
        jdbc.update("INSERT INTO match_record_events(team_id,match_id,action,actor_account_id,actor_username,occurred_at,played_on,match_kind,opponent,before_version,after_version,before_snapshot,after_snapshot) VALUES (1,1,'UPDATED',1,'migration-operator','2026-10-15 01:00:00','2026-10-15','INTERNAL','',2,3,?,?)", snapshot, snapshot);
        var beforeRecords = jdbc.queryForList("SELECT * FROM match_records ORDER BY id");
        var beforeHistory = jdbc.queryForList("SELECT * FROM match_record_events ORDER BY id");
        var beforeActual = jdbc.queryForList("SELECT * FROM match_appearances ORDER BY player_id");
        var beforePlan = jdbc.queryForList("SELECT * FROM match_planned_lineups ORDER BY player_id,quarter_number");
        var checksums = jdbc.queryForList("SELECT version,checksum FROM flyway_schema_history ORDER BY installed_rank");
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("28").load().migrate();
        var afterRecords = jdbc.queryForList("SELECT * FROM match_records ORDER BY id");
        afterRecords.forEach(row -> row.remove("match_format"));
        assertThat(afterRecords).isEqualTo(beforeRecords);
        assertThat(jdbc.queryForList("SELECT * FROM match_record_events ORDER BY id")).isEqualTo(beforeHistory);
        for (var rows : List.of(beforeActual, beforePlan)) for (var row : rows) {
            if (row.get("slot").equals("CDM")) row.put("slot", "CAM");
            else if (row.get("slot").equals("LWB")) row.put("slot", "LM");
            else if (row.get("slot").equals("RWB")) row.put("slot", "RM");
        }
        assertThat(jdbc.queryForList("SELECT * FROM match_appearances ORDER BY player_id")).isEqualTo(beforeActual);
        assertThat(jdbc.queryForList("SELECT * FROM match_planned_lineups ORDER BY player_id,quarter_number")).isEqualTo(beforePlan);
        assertThat(jdbc.queryForList("SELECT COALESCE(planned_team,'-') FROM match_participants ORDER BY player_id", String.class))
                .containsExactly("A", "A", "B", "B", "-", "-", "-");
        assertThat(jdbc.queryForList("SELECT version,checksum FROM flyway_schema_history WHERE version NOT IN ('26','27','28') ORDER BY installed_rank")).isEqualTo(checksums);
        assertThatThrownBy(() -> jdbc.update("UPDATE match_participants SET planned_team='C' WHERE player_id=1"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
    }
}
