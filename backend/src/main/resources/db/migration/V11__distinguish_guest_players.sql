ALTER TABLE players
    ADD COLUMN player_type VARCHAR(6) NOT NULL DEFAULT 'MEMBER',
    ADD CONSTRAINT chk_players_type CHECK (player_type IN ('MEMBER', 'GUEST'));

CREATE INDEX ix_players_type_active ON players (player_type, active, id);
