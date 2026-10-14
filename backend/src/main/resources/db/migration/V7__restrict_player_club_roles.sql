-- 골키퍼는 직책이 아니라 포지션이다. 빈 직책과 기존 골키퍼 직책은 정회원으로 정리한다.
UPDATE players SET club_role = '정회원', version = version + 1
WHERE club_role IS NULL OR TRIM(club_role) = '' OR club_role = '골키퍼';

ALTER TABLE players
    MODIFY club_role VARCHAR(30) NOT NULL DEFAULT '정회원',
    ADD CONSTRAINT chk_players_club_role CHECK (club_role IN ('정회원', '코치', '감독', '총무', '회장'));
