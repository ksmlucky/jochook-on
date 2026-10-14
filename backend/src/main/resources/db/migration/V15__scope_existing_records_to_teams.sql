-- V14가 생성한 기존 팀에 연결한다. 기존 선수/경기 PK와 하위 기록은 그대로 보존한다.
ALTER TABLE players ADD COLUMN team_id BIGINT NULL;
UPDATE players SET team_id = 1 WHERE team_id IS NULL;
ALTER TABLE players
    MODIFY team_id BIGINT NOT NULL,
    ADD CONSTRAINT fk_players_team FOREIGN KEY (team_id) REFERENCES teams(id),
    DROP INDEX uq_players_active_shirt,
    ADD CONSTRAINT uq_players_team_active_shirt UNIQUE (team_id, active_shirt_number),
    ADD INDEX ix_players_team_active_type (team_id, active, player_type);

ALTER TABLE match_records ADD COLUMN team_id BIGINT NULL;
UPDATE match_records SET team_id = 1 WHERE team_id IS NULL;
ALTER TABLE match_records
    MODIFY team_id BIGINT NOT NULL,
    ADD CONSTRAINT fk_match_records_team FOREIGN KEY (team_id) REFERENCES teams(id),
    ADD INDEX ix_match_records_team_date (team_id, played_on, id);

-- 하위 선수 FK는 보존한다. 경기 저장 서비스가 참석/계획/실제 출전의 모든
-- 선수에 대해 같은 team_id인지 검사한다. 클럽 소속은 수정 API로 변경할 수 없다.
