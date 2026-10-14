-- 쿼터 길이를 더 이상 저장하지 않는다. 적용 전 로컬 DB 백업을 보관한다.
ALTER TABLE match_quarters DROP CHECK chk_quarter_duration;
ALTER TABLE match_quarters DROP COLUMN duration_minutes;

-- 기존 출전자는 선발(0)로 보존한다. 같은 자리의 교체 선수(1)를 추가할 수 있다.
ALTER TABLE match_appearances
    ADD COLUMN entry_order INT NOT NULL DEFAULT 0,
    DROP PRIMARY KEY,
    ADD PRIMARY KEY (match_id, quarter_number, slot, entry_order),
    ADD CONSTRAINT chk_appearance_entry_order CHECK (entry_order IN (0, 1));
