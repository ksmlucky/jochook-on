-- Existing rows have no reliable writing checkpoint or completion decision.
-- Keep them NULL instead of inferring completion from scores/lineups.
ALTER TABLE match_records
    ADD COLUMN recording_stage VARCHAR(16) NULL,
    ADD CONSTRAINT chk_match_recording_stage CHECK (
        recording_stage IS NULL OR recording_stage IN ('ATTENDANCE','PLAN','ACTUAL','RESULT','COMPLETED')
    );
