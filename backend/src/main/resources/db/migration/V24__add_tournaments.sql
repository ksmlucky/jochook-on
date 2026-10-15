CREATE TABLE tournaments (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    team_id BIGINT NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    name VARCHAR(120) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    venue VARCHAR(120) NOT NULL DEFAULT '',
    division VARCHAR(80) NOT NULL DEFAULT '',
    notes VARCHAR(3000) NOT NULL DEFAULT '',
    CONSTRAINT fk_tournament_team FOREIGN KEY (team_id) REFERENCES teams(id),
    CONSTRAINT uq_tournament_team_id UNIQUE (team_id, id),
    CONSTRAINT chk_tournament_dates CHECK (end_date >= start_date),
    INDEX ix_tournament_team_dates (team_id, start_date, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Existing matches remain ordinary matches. No existing values or versions are changed.
ALTER TABLE match_records
    ADD COLUMN tournament_id BIGINT NULL,
    ADD COLUMN tournament_stage VARCHAR(20) NULL,
    ADD CONSTRAINT fk_match_team_tournament FOREIGN KEY (team_id, tournament_id) REFERENCES tournaments(team_id, id),
    ADD CONSTRAINT chk_match_tournament CHECK (
        (tournament_id IS NULL AND tournament_stage IS NULL)
        OR (tournament_id IS NOT NULL AND match_kind = 'EXTERNAL'
            AND (tournament_stage IS NULL OR tournament_stage IN ('GROUP', 'R16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL', 'THIRD_PLACE', 'OTHER')))
    ),
    ADD INDEX ix_match_team_tournament_date (team_id, tournament_id, played_on, id);
