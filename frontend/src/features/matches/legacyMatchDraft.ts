import type { MatchDraft, MatchTeam, Slot } from './api'
import { formationFor } from './formations.ts'
import { withEditablePlannedTeams } from './internalTeams.ts'

export function currentDraftSlot(draft: MatchDraft, team: MatchTeam, slot: Slot): Slot {
  const formation = formationFor(draft, team)
  if (formation === 'F352' && slot === 'CDM') return 'CAM'
  if (formation === 'F343' && slot === 'LWB') return 'LM'
  if (formation === 'F343' && slot === 'RWB') return 'RM'
  return slot
}

/** Migrate only the editable copy, retaining scores and player identity. Pending request bodies must never use this. */
export function upgradeEditableMatchDraft(draft: MatchDraft): MatchDraft {
  return withEditablePlannedTeams({ ...draft,
    plannedLineup: draft.plannedLineup.map(entry => ({ ...entry, slot: currentDraftSlot(draft, entry.team, entry.slot) })),
    quarters: draft.quarters.map(quarter => ({ ...quarter, lineup: quarter.lineup.map(entry => ({ ...entry, slot: currentDraftSlot(draft, entry.team, entry.slot) })) })),
  })
}

export function legacyDraftEntries(draft: MatchDraft) {
  return [
    ...draft.plannedLineup.map(entry => ({ ...entry, label: '계획', stats: '' })),
    ...draft.quarters.flatMap(quarter => quarter.lineup.map(entry => ({ ...entry, quarterNumber: quarter.number, label: '실제 출전', stats: `${entry.goals}골 · ${entry.assists}도움` }))),
  ].filter(entry => currentDraftSlot(draft, entry.team, entry.slot) !== entry.slot)
}
