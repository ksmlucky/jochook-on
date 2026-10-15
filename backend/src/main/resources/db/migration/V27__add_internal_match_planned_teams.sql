ALTER TABLE match_participants
    ADD COLUMN planned_team VARCHAR(1) NULL,
    ADD CONSTRAINT chk_participant_planned_team CHECK (planned_team IN ('A', 'B'));

-- Infer only unambiguous pre-match assignments. A player who switched planned teams
-- between quarters stays unassigned for the operator to review; actual teams are untouched.
UPDATE match_participants p
JOIN match_records m ON m.id = p.match_id AND m.match_kind = 'INTERNAL'
JOIN (SELECT match_id, player_id, MIN(team) AS planned_team
      FROM match_planned_lineups GROUP BY match_id, player_id HAVING COUNT(DISTINCT team) = 1) plan
  ON plan.match_id = p.match_id AND plan.player_id = p.player_id
SET p.planned_team = plan.planned_team;
