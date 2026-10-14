ALTER TABLE players
    ADD COLUMN first_choice VARCHAR(3) NULL,
    ADD COLUMN second_choice VARCHAR(3) NULL,
    ADD COLUMN third_choice VARCHAR(3) NULL,
    ADD CONSTRAINT chk_players_first_choice CHECK (first_choice IN ('LB','CB','RB','CDM','CM','LW','ST','RW','GK')),
    ADD CONSTRAINT chk_players_second_choice CHECK (second_choice IN ('LB','CB','RB','CDM','CM','LW','ST','RW','GK')),
    ADD CONSTRAINT chk_players_third_choice CHECK (third_choice IN ('LB','CB','RB','CDM','CM','LW','ST','RW','GK')),
    ADD CONSTRAINT chk_players_choice_order CHECK ((second_choice IS NULL OR first_choice IS NOT NULL) AND (third_choice IS NULL OR second_choice IS NOT NULL)),
    ADD CONSTRAINT chk_players_distinct_choices CHECK (first_choice <> second_choice AND first_choice <> third_choice AND second_choice <> third_choice);
