import { SessionExpiredError } from '../auth/api'
import { captureTeamScope, readTeamJson, readTeamBlob, teamFetch, teamFetchWithCsrf } from '../auth/teamRequest'
import { fetchPlayers, fetchGuests } from '../players/api'
import type { Player } from '../players/api'
import { serviceBrand } from '../../app/brand'

export const voteLabels = { ATTENDING: '참석 예정', ABSENT: '불참 예정', UNDECIDED: '미정', UNANSWERED: '미투표' } as const
export const attendanceLabels = { PRESENT: '참석', LATE: '지각', ABSENT: '불참', UNCONFIRMED: '미확인' } as const
export type Vote = keyof typeof voteLabels
export type Attendance = keyof typeof attendanceLabels
export const slots = ['GK', 'LB', 'LCB', 'RCB', 'RB', 'CDM', 'LCM', 'RCM', 'LW', 'ST', 'RW'] as const
export type Slot = typeof slots[number]
export const slotLabels: Record<Slot, string> = { GK: 'GK', LB: 'LB', LCB: 'CB (좌)', RCB: 'CB (우)', RB: 'RB', CDM: 'CDM', LCM: 'CM (좌)', RCM: 'CM (우)', LW: 'LW', ST: 'ST', RW: 'RW' }
export const pitchRows: Slot[][] = [['LW', 'ST', 'RW'], ['LCM', 'RCM'], ['CDM'], ['LB', 'LCB', 'RCB', 'RB'], ['GK']]
export interface Participant { playerId: number; name: string; shirtNumber: number | null; birthYear: number | null; vote: Vote; attendance: Attendance; playerType: 'MEMBER' | 'GUEST' }
export type MatchKind = 'EXTERNAL' | 'INTERNAL'
export type MatchTeam = 'A' | 'B'
export interface Appearance { team: MatchTeam; slot: Slot; playerId: number; goals: number; assists: number; entryOrder: 0 | 1 }
export interface Quarter { number: number; lineup: Appearance[] }
export interface PlannedEntry { team: MatchTeam; quarterNumber: number; slot: Slot; entryOrder: 0 | 1; playerId: number }
export interface LineupSuggestion {
  policyVersion: string; seed: number; plannedLineup: PlannedEntry[]; warnings: string[]; optimal: boolean
  allocations: { playerId: number; group: 'GK' | 'FIELD' | 'UNKNOWN'; attended: number; recorded: number; quarters: number; restQuarters: number[]; nonPreferredAppearances: number }[]
}
export async function suggestLineup(playedOn: string, playerIds: number[], matchId: number | null, seed: number, signal: AbortSignal): Promise<LineupSuggestion> {
  return read(await teamFetchWithCsrf('/api/v1/matches/lineup-suggestion', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ playedOn, playerIds, matchId, seed }),
  }))
}
export const quarterShare = (q: Quarter, a: Appearance) => q.lineup.filter(other => other.team === a.team && other.slot === a.slot).length === 2 ? 0.5 : 1
export interface MatchImportPreview {
  valid: boolean; quarters: Quarter[]
  rows: { rowNumber: number; values: string[]; playerId: number | null; name: string | null; shirtNumber: number | null; birthYear: number | null; errors: string[]; playerType: 'MEMBER' | 'GUEST' | null }[]
}
export interface MatchInfo { id: number; version: number; kind: MatchKind; playedOn: string; kickoff: string | null; venue: string; opponent: string; scoreFor: number | null; scoreAgainst: number | null }
export interface MatchScorer { playerId: number; name: string; shirtNumber: number | null; playerType: 'MEMBER' | 'GUEST'; goals: number; goalsA: number; goalsB: number }
export interface MatchSummary extends MatchInfo { scorers: MatchScorer[]; scorerCount: number }
export interface MatchRecord extends MatchInfo { notes: string; participants: Participant[]; quarters: Quarter[]; plannedLineup: PlannedEntry[] }
export type MatchDraft = Omit<MatchRecord, 'id' | 'version'>
export interface MatchPage { items: MatchSummary[]; page: number; totalPages: number; totalElements: number }
export interface MatchHistoryEntry {
  id: number; matchId: number; action: 'CREATED' | 'UPDATED' | 'DELETED'; actorUsername: string; occurredAt: string
  playedOn: string; kind: MatchKind; opponent: string; beforeVersion: number | null; afterVersion: number | null
}
export interface MatchHistoryDetail extends MatchHistoryEntry { before: MatchRecord | null; after: MatchRecord | null }
export interface MatchHistoryPage { items: MatchHistoryEntry[]; page: number; totalPages: number; totalElements: number }
export class MatchRequestError extends Error {
  constructor(message: string, public status: number) { super(message) }
}
async function read<T>(response: Response): Promise<T> {
  if (response.status === 401) throw new SessionExpiredError()
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: string } | null
    throw new MatchRequestError(response.status === 403 ? '운영진 권한 또는 로그인 유효 기간을 확인해 주세요.' : error?.message ?? '경기 기록 요청을 처리하지 못했습니다.', response.status)
  }
  return readTeamJson<T>(response)
}
export async function fetchMatches(page: number, signal?: AbortSignal): Promise<MatchPage> {
  return read(await teamFetch(`/api/v1/matches?page=${page}&size=10`, { signal, cache: 'no-store' }))
}
export async function fetchMatch(id: number): Promise<MatchRecord> { return read(await teamFetch(`/api/v1/matches/${id}`, { cache: 'no-store' })) }
export async function deleteMatch(match: Pick<MatchInfo, 'id' | 'version'>, signal?: AbortSignal): Promise<void> {
  const response = await teamFetchWithCsrf(`/api/v1/matches/${match.id}?version=${match.version}`, { method: 'DELETE', signal })
  if (response.status !== 204) await read(response)
}
export async function fetchMatchHistory(page: number, signal?: AbortSignal): Promise<MatchHistoryPage> {
  return read(await teamFetch(`/api/v1/matches/history?page=${page}&size=10`, { signal }))
}
export async function fetchMatchHistoryDetail(id: number, signal?: AbortSignal): Promise<MatchHistoryDetail> {
  return read(await teamFetch(`/api/v1/matches/history/${id}`, { signal }))
}
export async function previewMatchWorkbook(file: File): Promise<MatchImportPreview> {
  const form = new FormData(); form.append('file', file)
  return read(await teamFetchWithCsrf('/api/v1/matches/import/preview', { method: 'POST', body: form }))
}
export async function downloadMatchTemplate(): Promise<void> {
  const response = await teamFetch('/api/v1/matches/import/template')
  if (!response.ok) { await read(response); return }
  const url = URL.createObjectURL(await readTeamBlob(response))
  const link = document.createElement('a'); link.href = url; link.download = `${serviceBrand.slug}-match.xlsx`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export async function fetchMatchPlayers(signal: AbortSignal): Promise<Player[]> {
  const scope = captureTeamScope()
  const result: Player[] = []
  for (let page = 0; ; page++) {
    const data = await fetchPlayers(page, signal, undefined, scope)
    result.push(...data.items)
    if (page + 1 >= data.totalPages) return [...result, ...await fetchGuests(signal, scope)]
  }
}
export async function saveMatch(draft: MatchDraft, existing: MatchRecord | null): Promise<MatchRecord> {
  return read(await teamFetchWithCsrf(existing ? `/api/v1/matches/${existing.id}` : '/api/v1/matches', {
    method: existing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: draft.kind, playedOn: draft.playedOn, kickoff: draft.kickoff, venue: draft.venue, opponent: draft.opponent, notes: draft.notes, scoreFor: draft.scoreFor, scoreAgainst: draft.scoreAgainst,
      quarters: draft.quarters, plannedLineup: draft.plannedLineup, participants: draft.participants.map(({ playerId, vote, attendance }) => ({ playerId, vote, attendance })), version: existing?.version ?? null }),
  }))
}
export const canPlay = (p: Participant) => p.attendance === 'PRESENT' || p.attendance === 'LATE'
export const shirtLabel = (shirtNumber: number | null) => shirtNumber === null ? '등번호 없음' : `#${shirtNumber}`
export const playerLabel = (p: { name: string; shirtNumber: number | null; playerType?: 'MEMBER' | 'GUEST' }) => `${p.playerType === 'GUEST' ? '용병 · ' : ''}${shirtLabel(p.shirtNumber)} ${p.name}`
export function emptyMatch(players: Player[]): MatchDraft {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return { kind: 'EXTERNAL', playedOn: today, kickoff: null, venue: '', opponent: '', notes: '', scoreFor: null, scoreAgainst: null,
    participants: players.filter(p => p.playerType !== 'GUEST').slice(0, 200).map(p => ({ playerId: p.id, name: p.name, shirtNumber: p.shirtNumber, birthYear: p.birthYear, playerType: p.playerType, vote: 'UNANSWERED', attendance: 'UNCONFIRMED' })),
    quarters: [1, 2, 3, 4].map(number => ({ number, lineup: [] })), plannedLineup: [],
  }
}
