-- Retained independently of the match/account/team lifecycle: deleting a match must not
-- turn a retried create request into a new match. No request payload or personal data is stored.
CREATE TABLE match_save_requests (
    team_id BIGINT NOT NULL,
    actor_account_id BIGINT NOT NULL,
    request_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_method VARCHAR(4) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    target_match_id BIGINT NULL,
    request_fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    match_id BIGINT NULL,
    result_version BIGINT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    completed_at DATETIME(6) NULL,
    PRIMARY KEY (team_id, actor_account_id, request_key),
    CONSTRAINT chk_match_save_method CHECK ((request_method='POST' AND target_match_id IS NULL)
        OR (request_method='PUT' AND target_match_id IS NOT NULL)),
    CONSTRAINT chk_match_save_result CHECK ((match_id IS NULL AND result_version IS NULL AND completed_at IS NULL)
        OR (match_id IS NOT NULL AND result_version IS NOT NULL AND result_version >= 0 AND completed_at IS NOT NULL))
) ENGINE=InnoDB;
