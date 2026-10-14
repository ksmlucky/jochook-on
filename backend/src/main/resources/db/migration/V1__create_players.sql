CREATE TABLE players (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(60) NOT NULL,
    shirt_number INT NULL,
    position VARCHAR(2) NOT NULL,
    joined_on DATE NULL,
    active BIT(1) NOT NULL DEFAULT b'1',
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT chk_players_shirt_number CHECK (shirt_number BETWEEN 0 AND 99),
    CONSTRAINT chk_players_position CHECK (position IN ('GK', 'DF', 'MF', 'FW')),
    INDEX idx_players_active_id (active, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
