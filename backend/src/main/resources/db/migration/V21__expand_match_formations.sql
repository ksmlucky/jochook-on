-- Existing matches retain their original 4-1-2-3 and all recorded appearances.
ALTER TABLE match_records
    ADD COLUMN formation_a VARCHAR(8) NOT NULL DEFAULT 'F4123',
    ADD COLUMN formation_b VARCHAR(8) NOT NULL DEFAULT 'F4123',
    ADD CONSTRAINT chk_match_formation_a CHECK (formation_a IN ('F4123','F442','F4231','F4141')),
    ADD CONSTRAINT chk_match_formation_b CHECK (formation_b IN ('F4123','F442','F4231','F4141')),
    ADD CONSTRAINT chk_external_formation_b CHECK (match_kind = 'INTERNAL' OR formation_b = 'F4123');

ALTER TABLE match_appearances
    DROP CHECK chk_appearance_slot,
    MODIFY COLUMN slot VARCHAR(4) NOT NULL,
    ADD CONSTRAINT chk_appearance_slot CHECK (slot IN ('GK','LB','LCB','RCB','RB','CDM','LCM','RCM','LW','ST','RW','LM','RM','CAM','LCDM','RCDM','LST','RST'));

ALTER TABLE match_planned_lineups
    DROP CHECK chk_planned_slot,
    MODIFY COLUMN slot VARCHAR(4) NOT NULL,
    ADD CONSTRAINT chk_planned_slot CHECK (slot IN ('GK','LB','LCB','RCB','RB','CDM','LCM','RCM','LW','ST','RW','LM','RM','CAM','LCDM','RCDM','LST','RST'));

ALTER TABLE players
    DROP CHECK chk_players_first_choice,
    DROP CHECK chk_players_second_choice,
    DROP CHECK chk_players_third_choice,
    ADD CONSTRAINT chk_players_first_choice CHECK (first_choice IN ('LB','CB','RB','CDM','CM','LW','ST','RW','GK','LM','RM','CAM')),
    ADD CONSTRAINT chk_players_second_choice CHECK (second_choice IN ('LB','CB','RB','CDM','CM','LW','ST','RW','GK','LM','RM','CAM')),
    ADD CONSTRAINT chk_players_third_choice CHECK (third_choice IN ('LB','CB','RB','CDM','CM','LW','ST','RW','GK','LM','RM','CAM'));
