CREATE TABLE accounts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    username VARCHAR(40) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(10) NOT NULL,
    enabled BIT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    CONSTRAINT uk_accounts_username UNIQUE (username),
    CONSTRAINT chk_accounts_role CHECK (role IN ('ADMIN', 'MEMBER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
