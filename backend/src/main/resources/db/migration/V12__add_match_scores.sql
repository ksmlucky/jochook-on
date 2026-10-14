ALTER TABLE match_records
    ADD COLUMN score_for INT NULL,
    ADD COLUMN score_against INT NULL,
    ADD CONSTRAINT chk_match_scores CHECK (
        (score_for IS NULL AND score_against IS NULL)
        OR (score_for IS NOT NULL AND score_against IS NOT NULL
            AND score_for BETWEEN 0 AND 99 AND score_against BETWEEN 0 AND 99)
    );
