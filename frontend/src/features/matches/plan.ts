import type { MatchDraft, MatchTeam, Participant, PlannedEntry, Slot } from './api'
import { checkInternalPlanTeams } from './internalTeams.ts'
import { validateMatchPeriods } from './matchFormat.ts'

/** 운영진이 계획대로 참석·출전했음을 확인할 때만 호출한다. 기존 실제 기록은 보호한다. */
export function actualFromPlan(draft: MatchDraft): MatchDraft {
  validateMatchPeriods(draft)
  if (!draft.plannedLineup.length) throw new Error('02에서 계획 스쿼드를 먼저 배치해 주세요.')
  if (draft.quarters.some(q => q.lineup.length)) throw new Error('이미 실제 출전 기록이 있습니다. 기존 기록은 유지하고 03에서 직접 수정해 주세요.')
  checkPlan(draft.plannedLineup, draft.kind === 'INTERNAL' ? draft.participants : undefined)
  for (const entry of draft.plannedLineup) {
    const player = draft.participants.find(p => p.playerId === entry.playerId)
    if (!player || player.vote !== 'ATTENDING') throw new Error('계획에 배치한 선수의 참석 예정 상태를 확인해 주세요.')
    if (player.attendance === 'ABSENT') throw new Error(`${player.name} 선수는 실제 불참으로 기록되어 있습니다. 02 계획과 출석을 먼저 확인해 주세요.`)
  }
  return { ...draft,
    participants: draft.participants.map(p => p.vote === 'ATTENDING' && p.attendance === 'UNCONFIRMED' ? { ...p, attendance: 'PRESENT' } : p),
    quarters: draft.quarters.map(q => ({ ...q, lineup: draft.plannedLineup.filter(e => e.quarterNumber === q.number)
      .map(({ team, slot, playerId, entryOrder }) => ({ team, slot, playerId, entryOrder, goals: 0, assists: 0 })) })),
  }
}

export function checkPlan(entries: PlannedEntry[], internalParticipants?: Participant[]): void {
  const places = new Set<string>(), players = new Set<string>()
  for (const a of entries) {
    const place = `${a.quarterNumber}:${a.team}:${a.slot}:${a.entryOrder}`, person = `${a.quarterNumber}:${a.playerId}`
    if (places.has(place) || players.has(person)) throw new Error('같은 쿼터의 선수와 자리는 중복될 수 없습니다.')
    places.add(place); players.add(person)
  }
  if (entries.some(a => a.entryOrder === 1 && !places.has(`${a.quarterNumber}:${a.team}:${a.slot}:0`)))
    throw new Error('교체 선수의 선발 자리가 비게 됩니다. 교체 배치를 먼저 해제해 주세요.')
  if (internalParticipants) checkInternalPlanTeams(entries, internalParticipants)
}

/** 같은 쿼터 안에서 이동한다. 양쪽 자리에 선수가 있으면 서로 교환한다. */
export function placeInPlan(entries: PlannedEntry[], quarterNumber: number, slot: Slot, entryOrder: 0 | 1, playerId: number, team: MatchTeam = 'A', internalParticipants?: Participant[]): PlannedEntry[] {
  const source = entries.find(a => a.quarterNumber === quarterNumber && a.playerId === playerId)
  if (source && source.team !== team) throw new Error('다른 팀에 배치한 선수입니다. 해당 팀에서 먼저 배치를 해제해 주세요.')
  const target = entries.find(a => a.quarterNumber === quarterNumber && a.team === team && a.slot === slot && a.entryOrder === entryOrder)
  const next = entries.filter(a => a !== source && a !== target)
  next.push({ team, quarterNumber, slot, entryOrder, playerId })
  if (source && target && source !== target) next.push({ ...source, playerId: target.playerId })
  checkPlan(next, internalParticipants)
  return next
}

export function plannedShare(entries: PlannedEntry[], entry: PlannedEntry): number {
  return entries.filter(a => a.quarterNumber === entry.quarterNumber && a.team === entry.team && a.slot === entry.slot).length === 2 ? 0.5 : 1
}
