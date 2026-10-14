CREATE TABLE teams (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(40) NOT NULL,
    description VARCHAR(40) NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT chk_team_status CHECK (status IN ('PENDING', 'ACTIVE', 'INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- This is the existing club, not a new set of sample players or matches.
INSERT INTO teams (id, name, description, status) VALUES (1, 'HANA FC', '', 'ACTIVE');
ALTER TABLE accounts ADD COLUMN service_admin BIT(1) NOT NULL DEFAULT b'0';

CREATE TABLE team_memberships (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    team_id BIGINT NOT NULL,
    account_id BIGINT NOT NULL,
    role VARCHAR(10) NOT NULL,
    active BIT(1) NOT NULL DEFAULT b'1',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_membership_team_account UNIQUE (team_id, account_id),
    CONSTRAINT fk_membership_team FOREIGN KEY (team_id) REFERENCES teams(id),
    CONSTRAINT fk_membership_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    CONSTRAINT chk_membership_role CHECK (role IN ('ADMIN', 'MEMBER')),
    INDEX ix_membership_account (account_id, active, team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO team_memberships (team_id, account_id, role)
SELECT 1, id, role FROM accounts;

CREATE TABLE team_invites (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    team_id BIGINT NOT NULL,
    display_name VARCHAR(60) NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    expires_at TIMESTAMP(6) NOT NULL,
    used_at TIMESTAMP(6) NULL,
    cancelled_at TIMESTAMP(6) NULL,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_invite_token UNIQUE (token_hash),
    CONSTRAINT fk_invite_team FOREIGN KEY (team_id) REFERENCES teams(id),
    CONSTRAINT fk_invite_creator FOREIGN KEY (created_by) REFERENCES accounts(id),
    INDEX ix_invite_team (team_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE team_codes (
    team_id BIGINT NOT NULL PRIMARY KEY,
    code_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    version BIGINT NOT NULL DEFAULT 0,
    issued_at TIMESTAMP(6) NULL,
    expires_at TIMESTAMP(6) NULL,
    revoked_at TIMESTAMP(6) NULL,
    issued_by BIGINT NULL,
    CONSTRAINT uk_team_code_hash UNIQUE (code_hash),
    CONSTRAINT fk_code_team FOREIGN KEY (team_id) REFERENCES teams(id),
    CONSTRAINT fk_code_issuer FOREIGN KEY (issued_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO team_codes (team_id) VALUES (1);

CREATE TABLE team_creation_requests (
    account_id BIGINT NOT NULL,
    request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    team_id BIGINT NULL,
    invite_id BIGINT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (account_id, request_id),
    CONSTRAINT fk_creation_account FOREIGN KEY (account_id) REFERENCES accounts(id),
    CONSTRAINT fk_creation_team FOREIGN KEY (team_id) REFERENCES teams(id),
    CONSTRAINT fk_creation_invite FOREIGN KEY (invite_id) REFERENCES team_invites(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
