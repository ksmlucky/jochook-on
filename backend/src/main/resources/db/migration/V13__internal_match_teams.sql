-- 기존 경기는 외부 경기, 기존 배치는 A(우리 팀)로 보존한다.
ALTER TABLE match_records
    ADD COLUMN match_kind VARCHAR(16) NOT NULL DEFAULT 'EXTERNAL',
    ADD CONSTRAINT chk_match_kind CHECK (match_kind IN ('EXTERNAL', 'INTERNAL'));

ALTER TABLE match_appearances
    ADD COLUMN team VARCHAR(1) NOT NULL DEFAULT 'A',
    DROP PRIMARY KEY,
    ADD PRIMARY KEY (match_id, quarter_number, team, slot, entry_order),
    ADD CONSTRAINT chk_appearance_team CHECK (team IN ('A', 'B'));

ALTER TABLE match_planned_lineups
    ADD COLUMN team VARCHAR(1) NOT NULL DEFAULT 'A',
    DROP PRIMARY KEY,
    ADD PRIMARY KEY (match_id, quarter_number, team, slot, entry_order),
    ADD CONSTRAINT chk_planned_team CHECK (team IN ('A', 'B'));

-- uq_quarter_player / uq_planned_quarter_player는 팀 구분 없이 유지한다.
-- 따라서 같은 선수를 한 쿼터에 양 팀으로 중복 배치할 수 없다.
