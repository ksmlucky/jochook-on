-- Legacy goal/quarter totals do not establish relative chronology. Keep NULL until explicitly supplied.
-- Nonnegative values index the quarter's goal_events; -1 is one external conceded goal.
ALTER TABLE match_quarters ADD COLUMN scoring_order TEXT NULL,
    ADD CONSTRAINT ck_quarter_scoring_order_json CHECK (scoring_order IS NULL OR JSON_VALID(scoring_order));
