-- Expand allowed formations and positions without rewriting existing matches or preferences.
ALTER TABLE match_records
    DROP CHECK chk_match_formation_a,
    DROP CHECK chk_match_formation_b,
    ADD CONSTRAINT chk_match_formation_a CHECK (formation_a IN ('F4123','F442','F4231','F4141','F352','F343')),
    ADD CONSTRAINT chk_match_formation_b CHECK (formation_b IN ('F4123','F442','F4231','F4141','F352','F343'));

ALTER TABLE match_appearances
    DROP CHECK chk_appearance_slot,
    ADD CONSTRAINT chk_appearance_slot CHECK (slot IN ('GK','LB','LCB','RCB','RB','CDM','LCM','RCM','LW','ST','RW','LM','RM','CAM','LCDM','RCDM','LST','RST','CCB','LWB','RWB'));

ALTER TABLE match_planned_lineups
    DROP CHECK chk_planned_slot,
    ADD CONSTRAINT chk_planned_slot CHECK (slot IN ('GK','LB','LCB','RCB','RB','CDM','LCM','RCM','LW','ST','RW','LM','RM','CAM','LCDM','RCDM','LST','RST','CCB','LWB','RWB'));

ALTER TABLE players
    DROP CHECK chk_players_first_choice,
    DROP CHECK chk_players_second_choice,
    DROP CHECK chk_players_third_choice,
    ADD CONSTRAINT chk_players_first_choice CHECK (first_choice IN ('LB','CB','RB','CDM','CM','LW','ST','RW','GK','LM','RM','CAM','LWB','RWB')),
    ADD CONSTRAINT chk_players_second_choice CHECK (second_choice IN ('LB','CB','RB','CDM','CM','LW','ST','RW','GK','LM','RM','CAM','LWB','RWB')),
    ADD CONSTRAINT chk_players_third_choice CHECK (third_choice IN ('LB','CB','RB','CDM','CM','LW','ST','RW','GK','LM','RM','CAM','LWB','RWB'));
