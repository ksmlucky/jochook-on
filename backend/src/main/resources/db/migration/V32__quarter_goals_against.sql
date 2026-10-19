-- NULL preserves unknown legacy quarter scores; zero is an explicit clean sheet.
ALTER TABLE match_quarters ADD COLUMN goals_against INT NULL,
    ADD CONSTRAINT ck_quarter_goals_against CHECK (goals_against BETWEEN 0 AND 99);
