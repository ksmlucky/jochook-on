-- Existing operators keep write access as coaches; appoint directors explicitly.
ALTER TABLE team_memberships DROP CHECK chk_membership_role;
UPDATE team_memberships SET role = 'COACH' WHERE role = 'ADMIN';
ALTER TABLE team_memberships ADD CONSTRAINT chk_membership_role CHECK (role IN ('DIRECTOR', 'COACH', 'MEMBER'));

-- Previously issued links never implied director authority.
ALTER TABLE team_invites ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'COACH',
    ADD CONSTRAINT chk_invite_role CHECK (role IN ('DIRECTOR', 'COACH'));
