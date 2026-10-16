CREATE TABLE account_password_resets (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    account_id BIGINT NOT NULL,
    issued_by BIGINT NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    credential_version BIGINT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    used_at TIMESTAMP(6) NULL,
    revoked_at TIMESTAMP(6) NULL,
    CONSTRAINT uk_password_reset_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_password_reset_account FOREIGN KEY (account_id) REFERENCES accounts(id),
    CONSTRAINT fk_password_reset_issuer FOREIGN KEY (issued_by) REFERENCES accounts(id),
    INDEX ix_password_reset_account (account_id, used_at, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
