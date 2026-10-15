import type { MatchDraft, MatchTeam, Participant, PlannedEntry } from './api'
import type { Player, PreferredPosition } from '../players/api'

export const unassignedAttendees = (participants: Participant[]) => participants.filter(p => p.vote === 'ATTENDING' && !p.plannedTeam)
export const plannedTeamPlayers = (participants: Participant[], team: MatchTeam) => participants.filter(p => p.vote === 'ATTENDING' && p.plannedTeam === team)

export type InternalTeamCandidate = Pick<Participant, 'playerId' | 'name' | 'shirtNumber' | 'birthYear' | 'playerType'> & {
  preferences: PreferredPosition[]; existingOnly: boolean
}

/** The supplied roster is active. Keep already-recorded inactive players and guests available too. */
export function internalTeamCandidates(players: Player[], participants: Participant[]): InternalTeamCandidate[] {
  const candidates = new Map<number, InternalTeamCandidate>()
  for (const profile of players) {
    if (profile.playerType === 'GUEST' && !participants.some(p => p.playerId === profile.id)) continue
    const previous = participants.find(p => p.playerId === profile.id)
    candidates.set(profile.id, {
      playerId: profile.id, name: previous?.name ?? profile.name, shirtNumber: previous ? previous.shirtNumber : profile.shirtNumber,
      birthYear: previous ? previous.birthYear : profile.birthYear, playerType: previous?.playerType ?? profile.playerType,
      preferences: [profile.firstChoice, profile.secondChoice, profile.thirdChoice].filter((p): p is PreferredPosition => p !== null), existingOnly: false,
    })
  }
  for (const previous of participants) {
    if (!candidates.has(previous.playerId)) candidates.set(previous.playerId, {
      playerId: previous.playerId, name: previous.name, shirtNumber: previous.shirtNumber, birthYear: previous.birthYear,
      playerType: previous.playerType, preferences: [], existingOnly: true,
    })
  }
  return [...candidates.values()].sort((a, b) => (a.shirtNumber ?? 100) - (b.shirtNumber ?? 100) || a.name.localeCompare(b.name, 'ko') || a.playerId - b.playerId)
}

/** Checking a team card records both attendance intent and its team, never actual attendance. */
export function setInternalTeamSelection(draft: MatchDraft, candidate: InternalTeamCandidate, team: MatchTeam, selected: boolean): MatchDraft {
  if (draft.kind !== 'INTERNAL' || !['A', 'B'].includes(team)) throw new Error('자체전 A·B팀을 선택해 주세요.')
  const previous = draft.participants.find(p => p.playerId === candidate.playerId)
  if (previous?.plannedTeam && previous.plannedTeam !== team) throw new Error('이미 다른 팀 선수예요. 팀 이동 버튼으로 변경해 주세요.')
  if (!selected && (!previous || previous.vote !== 'ATTENDING' || previous.plannedTeam !== team)) return draft
  if (!previous && draft.participants.length >= 200) throw new Error('참가자는 경기당 최대 200명까지 등록할 수 있어요.')
  const next: Participant = {
    ...(previous ?? { playerId: candidate.playerId, name: candidate.name, shirtNumber: candidate.shirtNumber, birthYear: candidate.birthYear,
      playerType: candidate.playerType, attendance: 'UNCONFIRMED' as const }),
    vote: selected ? 'ATTENDING' : 'UNANSWERED', plannedTeam: selected ? team : null,
  }
  return { ...draft,
    participants: previous ? draft.participants.map(p => p.playerId === candidate.playerId ? next : p) : [...draft.participants, next],
    plannedLineup: withoutConflictingPlans(draft.plannedLineup, candidate.playerId, selected ? team : null),
  }
}

/** An editable legacy draft can infer stable teams. Never apply this to a frozen pending request. */
export function withEditablePlannedTeams(draft: MatchDraft): MatchDraft {
  if (draft.kind !== 'INTERNAL') return draft
  return { ...draft, participants: draft.participants.map(p => {
    if (p.plannedTeam !== undefined) return p
    const teams = new Set(draft.plannedLineup.filter(e => e.playerId === p.playerId).map(e => e.team))
    return { ...p, plannedTeam: teams.size === 1 ? [...teams][0] : null }
  }) }
}

export function checkInternalPlanTeams(entries: PlannedEntry[], participants: Participant[]): void {
  for (const entry of entries) {
    const player = participants.find(p => p.playerId === entry.playerId)
    if (!player || player.vote !== 'ATTENDING' || player.plannedTeam !== entry.team)
      throw new Error('01에서 정한 A·B팀과 계획 배치가 달라요. 팀 배정을 먼저 확인해 주세요.')
  }
}

export function teamChangeRemovesPlan(draft: MatchDraft, playerId: number, team: MatchTeam | null): boolean {
  return draft.plannedLineup.some(e => e.playerId === playerId && e.team !== team)
}

/** Remove only this player's conflicting plans; their former substitute becomes starter. Actual records stay intact. */
export function assignPlannedTeam(draft: MatchDraft, playerId: number, team: MatchTeam | null): MatchDraft {
  const player = draft.participants.find(p => p.playerId === playerId)
  if (draft.kind !== 'INTERNAL' || !player || player.vote !== 'ATTENDING') throw new Error('자체전 참석 예정 선수의 팀만 배정할 수 있어요.')
  return { ...draft, plannedLineup: withoutConflictingPlans(draft.plannedLineup, playerId, team), participants: draft.participants.map(p => p.playerId === playerId ? { ...p, plannedTeam: team } : p) }
}

function withoutConflictingPlans(entries: PlannedEntry[], playerId: number, team: MatchTeam | null): PlannedEntry[] {
  const removed = entries.filter(e => e.playerId === playerId && e.team !== team)
  const remaining = entries.filter(e => !removed.includes(e))
  return remaining.map(e => e.entryOrder === 1 && removed.some(old => old.entryOrder === 0 && old.quarterNumber === e.quarterNumber && old.team === e.team && old.slot === e.slot)
    ? { ...e, entryOrder: 0 as const } : e)
}
