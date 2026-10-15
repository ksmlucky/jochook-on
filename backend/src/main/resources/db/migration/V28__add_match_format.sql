-- Existing league and tournament records retain all four original quarters.
-- The two-half format is chosen explicitly for new/converted matches only.
ALTER TABLE match_records
    ADD COLUMN match_format VARCHAR(20) NOT NULL DEFAULT 'FOUR_QUARTERS',
    ADD CONSTRAINT chk_match_format CHECK (match_format IN ('FOUR_QUARTERS', 'TWO_HALVES_30')),
    ADD CONSTRAINT chk_internal_match_format CHECK (match_kind <> 'INTERNAL' OR match_format = 'FOUR_QUARTERS');
