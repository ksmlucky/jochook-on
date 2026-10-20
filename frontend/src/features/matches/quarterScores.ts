import type { MatchDraft, MatchTeam, Quarter } from './api'
import { invalidateChangedScoringOrder } from './scoringOrder.ts'

export const quarterGoals = (quarter: Quarter, team: MatchTeam) => quarter.lineup.filter(a => a.team === team).reduce((sum, a) => sum + a.goals, 0)

/** Called only on explicit result edits, never when opening a legacy record. */
export function updateQuarterResult(draft: MatchDraft, quarter: Quarter): MatchDraft {
  const previous = draft.quarters.find(q => q.number === quarter.number)!
  quarter = invalidateChangedScoringOrder(previous, quarter)
  const quarters = draft.quarters.map(q => q.number === quarter.number ? quarter : q)
  const goalsChanged = (team: MatchTeam) => quarterGoals(previous, team) !== quarterGoals(quarter, team)
  let scoreFor = draft.scoreFor, scoreAgainst = draft.scoreAgainst
  if (goalsChanged('A')) scoreFor = quarters.reduce((sum, q) => sum + quarterGoals(q, 'A'), 0)
  if (draft.kind === 'INTERNAL') {
    if (goalsChanged('B')) scoreAgainst = quarters.reduce((sum, q) => sum + quarterGoals(q, 'B'), 0)
  } else if (previous.goalsAgainst !== quarter.goalsAgainst || previous.goalsAgainstSpecified !== quarter.goalsAgainstSpecified) {
    scoreAgainst = quarters.reduce((sum, q) => sum + (q.goalsAgainst ?? 0), 0)
  }
  // The existing API stores scores as a pair. Editing assists alone leaves old scores intact.
  if (scoreFor !== draft.scoreFor || scoreAgainst !== draft.scoreAgainst) {
    scoreFor ??= quarters.reduce((sum, q) => sum + quarterGoals(q, 'A'), 0)
    scoreAgainst ??= draft.kind === 'INTERNAL' ? quarters.reduce((sum, q) => sum + quarterGoals(q, 'B'), 0) : quarters.reduce((sum, q) => sum + (q.goalsAgainst ?? 0), 0)
  }
  return { ...draft, quarters, scoreFor, scoreAgainst }
}
