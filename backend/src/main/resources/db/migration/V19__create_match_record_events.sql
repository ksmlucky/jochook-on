-- Existing matches have no reliable historical actor/timestamp. Start recording
-- their history on the next actual change instead of inventing creation events.
CREATE TABLE match_record_events (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    team_id BIGINT NOT NULL,
    match_id BIGINT NOT NULL,
    actor_account_id BIGINT NOT NULL,
    actor_username VARCHAR(40) NOT NULL,
    action VARCHAR(10) NOT NULL,
    -- Stored and read explicitly as UTC, independent of the connection timezone.
    occurred_at DATETIME(6) NOT NULL,
    played_on DATE NOT NULL,
    match_kind VARCHAR(16) NOT NULL,
    opponent VARCHAR(100) NOT NULL,
    before_version BIGINT NULL,
    after_version BIGINT NULL,
    before_snapshot JSON NULL,
    after_snapshot JSON NULL,
    CONSTRAINT fk_match_event_team FOREIGN KEY (team_id) REFERENCES teams(id),
    -- No match/player/account FK: historical snapshots survive later deletion.
    CONSTRAINT chk_match_event_action CHECK (action IN ('CREATED', 'UPDATED', 'DELETED')),
    CONSTRAINT chk_match_event_kind CHECK (match_kind IN ('EXTERNAL', 'INTERNAL')),
    CONSTRAINT chk_match_event_shape CHECK (
        (action='CREATED' AND before_version IS NULL AND before_snapshot IS NULL
            AND after_version IS NOT NULL AND after_version >= 0 AND after_snapshot IS NOT NULL)
        OR (action='UPDATED' AND before_version IS NOT NULL AND before_version >= 0 AND before_snapshot IS NOT NULL
            AND after_version IS NOT NULL AND after_version > before_version AND after_snapshot IS NOT NULL)
        OR (action='DELETED' AND before_version IS NOT NULL AND before_version >= 0 AND before_snapshot IS NOT NULL
            AND after_version IS NULL AND after_snapshot IS NULL)
    ),
    INDEX ix_match_event_team_time (team_id, occurred_at, id),
    INDEX ix_match_event_match_time (team_id, match_id, occurred_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
