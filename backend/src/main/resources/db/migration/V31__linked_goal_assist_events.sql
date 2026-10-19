ALTER TABLE match_quarters ADD COLUMN goal_events_linked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE match_goal_events (
    match_id BIGINT NOT NULL,
    event_order INT NOT NULL,
    quarter_number INT NOT NULL,
    scorer_id BIGINT NOT NULL,
    assist_id BIGINT NULL,
    goal_type VARCHAR(16) NOT NULL,
    team VARCHAR(1) NOT NULL,
    PRIMARY KEY (match_id, event_order),
    CONSTRAINT fk_goal_event_match FOREIGN KEY (match_id) REFERENCES match_records(id) ON DELETE CASCADE,
    CONSTRAINT fk_goal_event_scorer FOREIGN KEY (scorer_id) REFERENCES players(id),
    CONSTRAINT fk_goal_event_assist FOREIGN KEY (assist_id) REFERENCES players(id),
    CONSTRAINT chk_goal_event_order CHECK (event_order >= 0),
    CONSTRAINT chk_goal_event_quarter CHECK (quarter_number BETWEEN 1 AND 4),
    CONSTRAINT chk_goal_event_type CHECK (goal_type IN ('NORMAL', 'FREE_KICK', 'PENALTY')),
    CONSTRAINT chk_goal_event_team CHECK (team IN ('A', 'B')),
    CONSTRAINT chk_goal_event_helper CHECK (assist_id IS NULL OR (assist_id <> scorer_id AND goal_type = 'NORMAL')),
    INDEX idx_goal_event_quarter (match_id, quarter_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
