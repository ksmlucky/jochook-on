-- FK/PK are subsets of existing goals, not additional goals. Historical totals remain unchanged.
ALTER TABLE match_appearances
    ADD COLUMN free_kick_goals INT NOT NULL DEFAULT 0,
    ADD COLUMN penalty_goals INT NOT NULL DEFAULT 0,
    ADD CONSTRAINT chk_appearance_free_kick_goals CHECK (free_kick_goals BETWEEN 0 AND 99),
    ADD CONSTRAINT chk_appearance_penalty_goals CHECK (penalty_goals BETWEEN 0 AND 99),
    ADD CONSTRAINT chk_appearance_goal_types CHECK (free_kick_goals + penalty_goals <= goals);
