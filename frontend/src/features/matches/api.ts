import { SessionExpiredError } from '../auth/api'
import { captureTeamScope, readTeamJson, readTeamBlob, teamFetch, teamFetchWithCsrf } from '../auth/teamRequest'
import { fetchPlayers, fetchGuests } from '../players/api'
import type { Player } from '../players/api'
import { serviceBrand } from '../../app/brand'
import type { RecordingStage } from './recordingProgress'
import { toMatchPayload } from './matchPayload'
import type { MatchSaveReceipt } from './saveRecoveryFlow'
import type { Formation, Slot } from './formations'
export { slots, slotLabels } from './formations'
export type { Slot } from './formations'

export const voteLabels = { ATTENDING: '참석 예정', ABSENT: '불참 예정', UNDECIDED: '미정', UNANSWERED: '미투표' } as const
export const attendanceLabels = { PRESENT: '참석', LATE: '지각', ABSENT: '불참', UNCONFIRMED: '미확인' } as const
export type Vote = keyof typeof voteLabels
export type Attendance = keyof typeof attendanceLabels
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
export async function suggestLineup(playedOn: string, playerIds: number[], matchId: number | null, seed: number, signal: AbortSignal, formation: Formation = 'F4123'): Promise<LineupSuggestion> {
  return read(await teamFetchWithCsrf('/api/v1/matches/lineup-suggestion', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ playedOn, playerIds, matchId, seed, formation }),
  }))
}
export const quarterShare = (q: Quarter, a: Appearance) => q.lineup.filter(other => other.team === a.team && other.slot === a.slot).length === 2 ? 0.5 : 1
export interface MatchImportPreview {
  valid: boolean; quarters: Quarter[]
  rows: { rowNumber: number; values: string[]; playerId: number | null; name: string | null; shirtNumber: number | null; birthYear: number | null; errors: string[]; playerType: 'MEMBER' | 'GUEST' | null }[]
}
export interface MatchInfo { id: number; version: number; kind: MatchKind; playedOn: string; kickoff: string | null; venue: string; opponent: string; scoreFor: number | null; scoreAgainst: number | null; recordingStage?: RecordingStage | null; formationA?: Formation | null; formationB?: Formation | null }
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
  constructor(message: string, public status: number, public code?: string) { super(message) }
}
async function read<T>(response: Response): Promise<T> {
  if (response.status === 401) throw new SessionExpiredError()
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: string; code?: string } | null
    throw new MatchRequestError(response.status === 403 ? '운영진 권한 또는 로그인 유효 기간을 확인해 주세요.' : error?.message ?? '경기 기록 요청을 처리하지 못했습니다.', response.status, error?.code)
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
export async function previewMatchWorkbook(file: File, formation: Formation = 'F4123'): Promise<MatchImportPreview> {
  const form = new FormData(); form.append('file', file)
  return read(await teamFetchWithCsrf(`/api/v1/matches/import/preview?formation=${formation}`, { method: 'POST', body: form }))
}
export async function downloadMatchTemplate(formation: Formation = 'F4123'): Promise<void> {
  const response = await teamFetch(`/api/v1/matches/import/template?formation=${formation}`)
  if (!response.ok) { await read(response); return }
  const url = URL.createObjectURL(await readTeamBlob(response))
  const link = document.createElement('a'); link.href = url; link.download = `${serviceBrand.slug}-match-${formation.slice(1)}.xlsx`; link.click()
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
export async function fetchSaveReceipt(key: string): Promise<MatchSaveReceipt | null> {
  try { return await read(await teamFetch(`/api/v1/matches/save-requests/${encodeURIComponent(key)}`, { cache: 'no-store' })) }
  catch (cause) {
    if (cause instanceof MatchRequestError && cause.status === 404 && cause.code === 'SAVE_REQUEST_NOT_FOUND') return null
    throw cause
  }
}
export async function saveMatch(draft: MatchDraft, existing: MatchRecord | null, requestKey?: string): Promise<MatchRecord> {
  return read(await teamFetchWithCsrf(existing ? `/api/v1/matches/${existing.id}` : '/api/v1/matches', {
    method: existing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', ...(requestKey ? { 'Idempotency-Key': requestKey } : {}) },
    body: JSON.stringify(toMatchPayload(draft, existing)),
  }))
}
export const canPlay = (p: Participant) => p.attendance === 'PRESENT' || p.attendance === 'LATE'
export const shirtLabel = (shirtNumber: number | null) => shirtNumber === null ? '등번호 없음' : `#${shirtNumber}`
export const playerLabel = (p: { name: string; shirtNumber: number | null; playerType?: 'MEMBER' | 'GUEST' }) => `${p.playerType === 'GUEST' ? '용병 · ' : ''}${shirtLabel(p.shirtNumber)} ${p.name}`
export function emptyMatch(players: Player[]): MatchDraft {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return { kind: 'EXTERNAL', formationA: 'F4123', formationB: 'F4123', playedOn: today, kickoff: null, venue: '', opponent: '', notes: '', scoreFor: null, scoreAgainst: null,
    participants: players.filter(p => p.playerType !== 'GUEST').slice(0, 200).map(p => ({ playerId: p.id, name: p.name, shirtNumber: p.shirtNumber, birthYear: p.birthYear, playerType: p.playerType, vote: 'UNANSWERED', attendance: 'UNCONFIRMED' })),
    quarters: [1, 2, 3, 4].map(number => ({ number, lineup: [] })), plannedLineup: [],
  }
}
