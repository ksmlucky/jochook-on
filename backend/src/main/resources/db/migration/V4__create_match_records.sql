CREATE TABLE match_records (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    played_on DATE NOT NULL,
    kickoff TIME NULL,
    venue VARCHAR(100) NOT NULL,
    opponent VARCHAR(100) NOT NULL,
    notes VARCHAR(3000) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    INDEX idx_matches_date_id (played_on, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE match_participants (
    match_id BIGINT NOT NULL,
    player_id BIGINT NOT NULL,
    vote VARCHAR(16) NOT NULL,
    attendance VARCHAR(16) NOT NULL,
    PRIMARY KEY (match_id, player_id),
    CONSTRAINT fk_participant_match FOREIGN KEY (match_id) REFERENCES match_records(id),
    CONSTRAINT fk_participant_player FOREIGN KEY (player_id) REFERENCES players(id),
    CONSTRAINT chk_participant_vote CHECK (vote IN ('ATTENDING', 'ABSENT', 'UNDECIDED', 'UNANSWERED')),
    CONSTRAINT chk_participant_attendance CHECK (attendance IN ('PRESENT', 'LATE', 'ABSENT', 'UNCONFIRMED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE match_quarters (
    match_id BIGINT NOT NULL,
    quarter_number INT NOT NULL,
    duration_minutes INT NOT NULL,
    PRIMARY KEY (match_id, quarter_number),
    CONSTRAINT fk_quarter_match FOREIGN KEY (match_id) REFERENCES match_records(id),
    CONSTRAINT chk_quarter_number CHECK (quarter_number BETWEEN 1 AND 4),
    CONSTRAINT chk_quarter_duration CHECK (duration_minutes BETWEEN 1 AND 120)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE match_appearances (
    match_id BIGINT NOT NULL,
    quarter_number INT NOT NULL,
    slot VARCHAR(3) NOT NULL,
    player_id BIGINT NOT NULL,
    goals INT NOT NULL,
    assists INT NOT NULL,
    PRIMARY KEY (match_id, quarter_number, slot),
    CONSTRAINT uq_quarter_player UNIQUE (match_id, quarter_number, player_id),
    CONSTRAINT fk_appearance_match FOREIGN KEY (match_id) REFERENCES match_records(id),
    CONSTRAINT fk_appearance_player FOREIGN KEY (player_id) REFERENCES players(id),
    CONSTRAINT chk_appearance_quarter CHECK (quarter_number BETWEEN 1 AND 4),
    CONSTRAINT chk_appearance_slot CHECK (slot IN ('GK','LB','LCB','RCB','RB','CDM','LCM','RCM','LW','ST','RW')),
    CONSTRAINT chk_appearance_goals CHECK (goals BETWEEN 0 AND 99),
    CONSTRAINT chk_appearance_assists CHECK (assists BETWEEN 0 AND 99)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
