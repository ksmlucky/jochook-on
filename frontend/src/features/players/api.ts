import { SessionExpiredError } from '../auth/api'
import { captureTeamScope, readTeamJson, readTeamBlob, teamFetch, teamFetchWithCsrf } from '../auth/teamRequest'
import type { TeamRequestScope } from '../auth/teamRequest'
import { serviceBrand } from '../../app/brand'
import { ageGroupOptions, playerQueryParams } from './query'
import type { AgeGroup, PlayerQuery } from './query'
export type { PlayerQuery } from './query'

export type Position = 'GK' | 'DF' | 'MF' | 'FW' | 'UN'
export const preferredPositions = ['LB', 'CB', 'RB', 'CDM', 'CM', 'LW', 'ST', 'RW', 'GK'] as const
export type PreferredPosition = typeof preferredPositions[number]
export function preferredPositionGroup(position: PreferredPosition | null): Position {
  if (position === 'GK') return 'GK'
  if (position === 'LW' || position === 'RW' || position === 'ST') return 'FW'
  if (position === 'CM' || position === 'CDM') return 'MF'
  if (position === 'LB' || position === 'CB' || position === 'RB') return 'DF'
  return 'UN'
}

export interface Player {
  playerType: 'MEMBER' | 'GUEST'
  id: number
  name: string
  shirtNumber: number | null
  position: Position
  joinedOn: string | null
  birthYear: number | null
  clubRole: string | null
  version: number
  firstChoice: PreferredPosition | null
  secondChoice: PreferredPosition | null
  thirdChoice: PreferredPosition | null
}

export type PlayerDetails = Pick<Player, 'name' | 'shirtNumber' | 'position' | 'joinedOn' | 'firstChoice' | 'secondChoice' | 'thirdChoice' | 'birthYear' | 'clubRole'>
export const positionLabels: Record<Position, string> = {
  GK: '골키퍼', DF: '수비수', MF: '미드필더', FW: '공격수', UN: '포지션 미확인',
}

export class PlayerRequestError extends Error {
  constructor(message: string, public status: number, public fieldErrors: Record<string, string> = {}) {
    super(message)
  }
}

export interface PlayerPage {
  items: Player[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  availableAgeGroups: AgeGroup[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPlayer(value: unknown): value is Player {
  return isRecord(value)
    && Number.isSafeInteger(value.id)
    && typeof value.name === 'string'
    && (value.shirtNumber === null || Number.isInteger(value.shirtNumber))
    && typeof value.position === 'string'
    && ['GK', 'DF', 'MF', 'FW', 'UN'].includes(value.position)
    && (value.birthYear === null || Number.isInteger(value.birthYear))
    && (value.clubRole === null || typeof value.clubRole === 'string')
    && (value.joinedOn === null || (typeof value.joinedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.joinedOn)))
    && typeof value.version === 'number' && Number.isSafeInteger(value.version) && value.version >= 0
    && ['firstChoice', 'secondChoice', 'thirdChoice'].every(key => value[key] === null || preferredPositions.includes(value[key] as PreferredPosition))
}

async function checkResponse(response: Response): Promise<void> {
  if (response.status === 401) throw new SessionExpiredError()
  if (!response.ok) {
    if (response.status === 403) throw new PlayerRequestError('운영진 권한 또는 요청 유효 기간을 확인해 주세요. 필요하면 다시 로그인해 주세요.', 403)
    const error: unknown = await readTeamJson(response).catch(() => null)
    const fields: Record<string, string> = {}
    if (isRecord(error) && isRecord(error.fieldErrors)) {
      for (const [key, value] of Object.entries(error.fieldErrors)) if (typeof value === 'string') fields[key] = value
    }
    throw new PlayerRequestError(isRecord(error) && typeof error.message === 'string' ? error.message : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.', response.status, fields)
  }
}

async function readPlayer(response: Response): Promise<Player> {
  await checkResponse(response)
  const data: unknown = await readTeamJson(response)
  if (!isPlayer(data)) throw new Error('선수 정보 형식을 확인할 수 없습니다. 목록을 다시 확인해 주세요.')
  return data
}

export interface BulkPlayerRow {
  name: string; position: string; shirtNumber: string; joinedOn: string
  firstChoice: string; secondChoice: string; thirdChoice: string; birthYear: string; clubRole: string
}
export interface ImportRow { rowNumber: number; values: BulkPlayerRow; errors: string[]; warnings: string[] }
export interface ImportPreview { rows: ImportRow[]; valid: boolean }

async function readPreview(response: Response): Promise<ImportPreview> {
  await checkResponse(response)
  return readTeamJson<ImportPreview>(response)
}
export async function previewBulk(rows: BulkPlayerRow[]): Promise<ImportPreview> {
  return readPreview(await teamFetchWithCsrf('/api/v1/players/bulk/preview', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }),
  }))
}
export async function uploadWorkbook(file: File): Promise<ImportPreview> {
  const body = new FormData(); body.append('file', file)
  return readPreview(await teamFetchWithCsrf('/api/v1/players/import/preview', { method: 'POST', body }))
}
export async function registerBulk(rows: BulkPlayerRow[]): Promise<Player[]> {
  const response = await teamFetchWithCsrf('/api/v1/players/bulk', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }),
  })
  await checkResponse(response)
  const data: unknown = await readTeamJson(response)
  if (!Array.isArray(data) || !data.every(isPlayer)) throw new Error('등록 결과를 확인하지 못했습니다. 재등록하기 전에 선수 목록을 확인해 주세요.')
  return data
}
export async function downloadPlayerTemplate(): Promise<void> {
  const response = await teamFetch('/api/v1/players/import/template')
  await checkResponse(response)
  const url = URL.createObjectURL(await readTeamBlob(response))
  const link = document.createElement('a'); link.href = url; link.download = `${serviceBrand.slug}-players.xlsx`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function fetchPlayer(id: number): Promise<Player> {
  return readPlayer(await teamFetch(`/api/v1/players/${id}`, { cache: 'no-store' }))
}

export async function savePlayer(details: PlayerDetails, existing: Player | null): Promise<Player> {
  return readPlayer(await teamFetchWithCsrf(existing ? `/api/v1/players/${existing.id}` : '/api/v1/players', {
    method: existing ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(existing ? { ...details, version: existing.version } : details),
  }))
}

export type GuestDetails = Pick<Player, 'name' | 'shirtNumber' | 'birthYear' | 'firstChoice' | 'secondChoice' | 'thirdChoice'>
export async function createGuest(details: GuestDetails): Promise<Player> {
  return readPlayer(await teamFetchWithCsrf('/api/v1/players/guests', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(details),
  }))
}
export async function fetchGuests(signal: AbortSignal, scope: TeamRequestScope = captureTeamScope()): Promise<Player[]> {
  const guests: Player[] = []
  for (let page = 0; ; page++) {
    const response = await teamFetch(`/api/v1/players/guests?page=${page}&size=100`, { signal, cache: 'no-store' }, scope)
    await checkResponse(response)
    const data: unknown = await readTeamJson(response)
    if (!isPlayerPage(data)) throw new Error('용병 목록을 확인하지 못했습니다.')
    guests.push(...data.items)
    if (page + 1 >= data.totalPages) return guests
  }
}

function isPlayerPage(value: unknown): value is PlayerPage {
  return isRecord(value)
    && Array.isArray(value.items)
    && value.items.every(isPlayer)
    && Array.isArray(value.availableAgeGroups)
    && value.availableAgeGroups.every(group => ageGroupOptions.some(([code]) => code === group))
    && ['page', 'size', 'totalElements', 'totalPages'].every(key =>
      typeof value[key] === 'number' && Number.isSafeInteger(value[key]) && value[key] >= 0)
}

export async function fetchPlayers(page: number, signal: AbortSignal, query: PlayerQuery = { size: 20, sort: 'id', direction: 'asc' }, scope: TeamRequestScope = captureTeamScope()): Promise<PlayerPage> {
  const params = playerQueryParams(page, query)
  const response = await teamFetch(`/api/v1/players?${params}`, { signal }, scope)
  if (response.status === 401) throw new SessionExpiredError()
  if (!response.ok) throw new Error(`Player request failed: ${response.status}`)
  const data: unknown = await readTeamJson(response)
  if (!isPlayerPage(data)) throw new Error('Unexpected player response')
  return data
}
