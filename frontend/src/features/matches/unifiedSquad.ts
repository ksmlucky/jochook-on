import type { Appearance, MatchDraft, MatchTeam, Participant, PlannedEntry, Slot } from './api'
import { checkPlan, placeInPlan, removeFromPlan } from './plan.ts'
import { editActualAppearance } from './appearanceEdit.ts'
import { validateMatchPeriods } from './matchFormat.ts'
import { withGoalEvents } from './goalEvents.ts'

const canPlay = (p: Participant) => p.attendance === 'PRESENT' || p.attendance === 'LATE'
const hasStats = (a: Appearance) => !!(a.goals || a.assists || a.freeKickGoals || a.penaltyGoals)
export const squadEntries = (draft: MatchDraft): PlannedEntry[] => draft.quarters.flatMap(q => q.lineup.map(({ team, slot, playerId, entryOrder }) => ({ quarterNumber: q.number, team, slot, playerId, entryOrder })))

/** Editable view only. Frozen pending requests must never be upgraded before receipt recovery. */
export function unifiedDraft(draft: MatchDraft): MatchDraft {
  const hasActual = draft.quarters.some(q => q.lineup.length)
  const participants = draft.participants.map(p => draft.recordingStage !== 'COMPLETED' && p.vote === 'ATTENDING' && p.attendance === 'UNCONFIRMED' ? { ...p, attendance: 'PRESENT' as const } : p)
  return { ...draft, participants, plannedLineup: [], quarters: hasActual || draft.recordingStage === 'COMPLETED' || !draft.plannedLineup.length ? draft.quarters : draft.quarters.map(q => ({ ...q,
    lineup: draft.plannedLineup.filter(e => e.quarterNumber === q.number).map(({ team, slot, playerId, entryOrder }) => ({ team, slot, playerId, entryOrder, goals: 0, assists: 0 })),
  })) }
}

/** Adapter for the existing planner/solver; attendance is the single source for its candidates. */
export function squadPlanningView(draft: MatchDraft): MatchDraft {
  const plannedLineup = squadEntries(draft)
  return { ...draft, plannedLineup, participants: draft.participants.map(p => {
    const teams = new Set(plannedLineup.filter(e => e.playerId === p.playerId).map(e => e.team))
    return { ...p, vote: canPlay(p) ? 'ATTENDING' : 'UNANSWERED', plannedTeam: draft.kind === 'EXTERNAL' ? null : p.plannedTeam ?? (teams.size === 1 ? [...teams][0] : null) }
  }) }
}

/** Move a player's stats with the player, never with the vacated slot. Do not discard recorded stats. */
export function applySquad(draft: MatchDraft, entries: PlannedEntry[]): MatchDraft {
  const view = squadPlanningView(draft)
  checkPlan(entries, draft.kind === 'INTERNAL' ? view.participants : undefined)
  const numbers = new Set(draft.quarters.map(q => q.number))
  if (entries.some(e => !numbers.has(e.quarterNumber))) throw new Error('현재 경기 형식의 구간만 배치할 수 있어요.')
  const quarters = draft.quarters.map(q => {
    const next = entries.filter(e => e.quarterNumber === q.number)
    if (q.lineup.some(a => hasStats(a) && !next.some(e => e.playerId === a.playerId && e.team === a.team)))
      throw new Error('골·도움 기록이 있는 선수는 배치에서 뺄 수 없어요. 기록을 먼저 확인하고 정정해 주세요.')
    return { ...q, lineup: next.map(({ quarterNumber: _number, ...entry }) => {
      const previous = q.lineup.find(a => a.playerId === entry.playerId)
      // Preserve legacy entries with unresolved attendance until explicitly repaired.
      if (!previous && !draft.participants.some(p => p.playerId === entry.playerId && canPlay(p))) throw new Error('01에서 참석할 선수를 먼저 선택해 주세요.')
      return { goals: 0, assists: 0, ...previous, ...entry }
    }) }
  })
  const result = { ...draft, plannedLineup: [], quarters }
  result.quarters = result.quarters.map(q => Array.isArray(q.goalEvents) ? withGoalEvents(q, q.goalEvents) : q)
  validateMatchPeriods(result)
  return result
}

export function editSquad(draft: MatchDraft, quarter: number, team: MatchTeam, slot: Slot, order: 0 | 1, patch: Partial<Appearance> | null): MatchDraft {
  if (patch && !Object.hasOwn(patch, 'playerId') && Array.isArray(draft.quarters.find(q => q.number === quarter)?.goalEvents))
    throw new Error('이 구간의 골·도움은 골별 기록에서 수정해 주세요.')
  if (patch && !Object.hasOwn(patch, 'playerId')) return { ...draft, quarters: editActualAppearance(draft.quarters, draft.participants, quarter, team, slot, order, patch) }
  const view = squadPlanningView(draft)
  const removed = view.plannedLineup.find(e => e.quarterNumber === quarter && e.team === team && e.slot === slot && e.entryOrder === order)
  const entries = patch ? placeInPlan(view.plannedLineup, quarter, slot, order, patch.playerId!, team, draft.kind === 'INTERNAL' ? view.participants : undefined)
    : removed ? removeFromPlan(view.plannedLineup, removed) : view.plannedLineup
  return applySquad(draft, entries)
}

export function updateSquadParticipant(draft: MatchDraft, id: number, patch: Partial<Participant>): MatchDraft {
  const previous = draft.participants.find(p => p.playerId === id)
  if (!previous) throw new Error('경기 명단의 선수를 선택해 주세요.')
  const next = { ...previous, ...patch }
  if (patch.vote) next.attendance = patch.vote === 'ATTENDING' ? previous.attendance === 'LATE' ? 'LATE' : 'PRESENT' : 'UNCONFIRMED'
  if (!canPlay(next)) next.plannedTeam = null
  const changed = { ...draft, participants: draft.participants.map(p => p.playerId === id ? next : p) }
  if (canPlay(next)) return changed
  const entries = squadEntries(draft), removed = entries.filter(e => e.playerId === id)
  const remaining = entries.filter(e => e.playerId !== id).map(e => e.entryOrder === 1 && removed.some(a => a.quarterNumber === e.quarterNumber && a.team === e.team && a.slot === e.slot && a.entryOrder === 0) ? { ...e, entryOrder: 0 as const } : e)
  return applySquad(changed, remaining)
}

export function applySquadTeamSelection(draft: MatchDraft, next: MatchDraft): MatchDraft {
  const previous = squadPlanningView(draft)
  const participants = next.participants.map(p => {
    const old = previous.participants.find(a => a.playerId === p.playerId)
    if (p.vote === old?.vote) return { ...p, vote: draft.participants.find(a => a.playerId === p.playerId)?.vote ?? p.vote }
    return { ...p, attendance: p.vote === 'ATTENDING' ? 'PRESENT' as const : 'UNCONFIRMED' as const }
  })
  return applySquad({ ...draft, participants }, next.plannedLineup)
}
