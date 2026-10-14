-- Code history starts here. Older code states do not contain enough information
-- to reconstruct who rotated/revoked a code or all past event timestamps.
CREATE TABLE team_code_events (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    team_id BIGINT NOT NULL,
    actor_account_id BIGINT NOT NULL,
    action VARCHAR(10) NOT NULL,
    version BIGINT NOT NULL,
    occurred_at TIMESTAMP(6) NOT NULL,
    expires_at TIMESTAMP(6) NULL,
    CONSTRAINT fk_code_event_team FOREIGN KEY (team_id) REFERENCES teams(id),
    CONSTRAINT fk_code_event_actor FOREIGN KEY (actor_account_id) REFERENCES accounts(id),
    CONSTRAINT chk_code_event_action CHECK (action IN ('ISSUED', 'ROTATED', 'REVOKED')),
    CONSTRAINT chk_code_event_version CHECK (version > 0),
    CONSTRAINT uk_code_event_team_version UNIQUE (team_id, version),
    INDEX ix_code_event_team_time (team_id, occurred_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
