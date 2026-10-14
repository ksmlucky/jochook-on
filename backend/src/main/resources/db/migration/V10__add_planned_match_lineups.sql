-- 경기 전 계획은 실제 출전·득점·도움과 분리한다.
CREATE TABLE match_planned_lineups (
    match_id BIGINT NOT NULL,
    quarter_number INT NOT NULL,
    slot VARCHAR(3) NOT NULL,
    entry_order INT NOT NULL,
    player_id BIGINT NOT NULL,
    PRIMARY KEY (match_id, quarter_number, slot, entry_order),
    CONSTRAINT uq_planned_quarter_player UNIQUE (match_id, quarter_number, player_id),
    CONSTRAINT fk_planned_match FOREIGN KEY (match_id) REFERENCES match_records(id),
    CONSTRAINT fk_planned_player FOREIGN KEY (player_id) REFERENCES players(id),
    CONSTRAINT chk_planned_quarter CHECK (quarter_number BETWEEN 1 AND 4),
    CONSTRAINT chk_planned_entry CHECK (entry_order IN (0, 1)),
    CONSTRAINT chk_planned_slot CHECK (slot IN ('GK','LB','LCB','RCB','RB','CDM','LCM','RCM','LW','ST','RW'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
