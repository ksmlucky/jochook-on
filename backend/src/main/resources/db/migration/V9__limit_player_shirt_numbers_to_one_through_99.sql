-- 0번이 남아 있으면 임의로 바꾸지 않고 중단하여 원본 확인을 요청한다.
ALTER TABLE players
    DROP CHECK chk_players_shirt_number,
    ADD CONSTRAINT chk_players_shirt_number CHECK (shirt_number BETWEEN 1 AND 99);
