ALTER TABLE players
    ADD COLUMN birth_year INT NULL,
    ADD COLUMN club_role VARCHAR(30) NULL,
    ADD CONSTRAINT chk_players_birth_year CHECK (birth_year BETWEEN 1900 AND 9999),
    DROP CHECK chk_players_position,
    ADD CONSTRAINT chk_players_position CHECK (position IN ('GK', 'DF', 'MF', 'FW', 'UN')),
    ADD CONSTRAINT chk_players_unknown_preferences CHECK
        (position <> 'UN' OR (first_choice IS NULL AND second_choice IS NULL AND third_choice IS NULL));
