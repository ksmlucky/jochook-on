ALTER TABLE team_codes ADD COLUMN password_hash VARCHAR(100) NULL;

-- A legacy code has never required a password. Revoke it and its versioned sessions;
-- never invent a password or retain code-only access after this migration.
UPDATE team_codes
SET code_hash = NULL,
    version = version + 1,
    revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP(6))
WHERE code_hash IS NOT NULL;
