-- NULL은 여러 명 허용한다. 활동 종료 선수의 등번호는 재사용할 수 있다.
-- 기존에 활동 선수 등번호가 중복되어 있다면 임의 변경하지 않고 마이그레이션을 중단한다.
ALTER TABLE players
    ADD COLUMN active_shirt_number INT GENERATED ALWAYS AS
        (CASE WHEN active = 1 THEN shirt_number ELSE NULL END) STORED,
    ADD CONSTRAINT uq_players_active_shirt UNIQUE (active_shirt_number);
