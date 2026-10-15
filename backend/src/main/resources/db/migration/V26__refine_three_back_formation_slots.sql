-- Refine current formations without deleting appearances, substitutions or scoring totals.
-- Historical audit JSON remains the immutable snapshot of its original formation.
UPDATE match_planned_lineups p JOIN match_records m ON m.id = p.match_id
SET p.slot = CASE
    WHEN (CASE WHEN p.team = 'B' THEN m.formation_b ELSE m.formation_a END) = 'F352' THEN 'CAM'
    WHEN p.slot = 'LWB' THEN 'LM' ELSE 'RM' END
WHERE ((CASE WHEN p.team = 'B' THEN m.formation_b ELSE m.formation_a END) = 'F352' AND p.slot = 'CDM')
   OR ((CASE WHEN p.team = 'B' THEN m.formation_b ELSE m.formation_a END) = 'F343' AND p.slot IN ('LWB', 'RWB'));

UPDATE match_appearances a JOIN match_records m ON m.id = a.match_id
SET a.slot = CASE
    WHEN (CASE WHEN a.team = 'B' THEN m.formation_b ELSE m.formation_a END) = 'F352' THEN 'CAM'
    WHEN a.slot = 'LWB' THEN 'LM' ELSE 'RM' END
WHERE ((CASE WHEN a.team = 'B' THEN m.formation_b ELSE m.formation_a END) = 'F352' AND a.slot = 'CDM')
   OR ((CASE WHEN a.team = 'B' THEN m.formation_b ELSE m.formation_a END) = 'F343' AND a.slot IN ('LWB', 'RWB'));
