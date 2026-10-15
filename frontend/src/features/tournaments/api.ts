import { captureTeamScope, readTeamJson, teamFetch } from '../auth/teamRequest'
import type { TeamRequestScope } from '../auth/teamRequest'
import type { Tournament, TournamentDraft, TournamentPage } from './types'
import { appendYearMonthQuery } from '../../app/yearMonth.ts'
import type { YearMonthSelection } from '../../app/yearMonth'
export type { Tournament, TournamentDraft, TournamentPage } from './types'

export class TournamentRequestError extends Error {
  constructor(message: string, public status: number, public fieldErrors: Record<string, string> = {}) { super(message) }
}
async function read<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await readTeamJson<{ message?: string; fieldErrors?: Record<string, string> }>(response).catch(cause => {
      if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
      return null
    })
    throw new TournamentRequestError(error?.message || (response.status === 404 ? '대회를 찾지 못했어요. 목록을 다시 확인해 주세요.' : '대회 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'), response.status, error?.fieldErrors ?? {})
  }
  return readTeamJson<T>(response)
}
export async function fetchTournaments(page: number, signal?: AbortSignal, size = 10, scope?: TeamRequestScope, period: Partial<YearMonthSelection> = {}): Promise<TournamentPage> {
  if (!Number.isSafeInteger(page) || page < 0 || !Number.isInteger(size) || size < 1 || size > 100) throw new RangeError('대회 목록 페이지 범위를 확인해 주세요.')
  const query = new URLSearchParams({ page: String(page), size: String(size) })
  appendYearMonthQuery(query, period)
  return read(await teamFetch(`/api/v1/tournaments?${query}`, { signal }, scope))
}
export async function fetchTournamentYears(signal?: AbortSignal): Promise<number[]> { return read(await teamFetch('/api/v1/tournaments/years', { signal })) }
export async function fetchAllTournaments(signal: AbortSignal): Promise<Tournament[]> {
  const scope = captureTeamScope(), rows: Tournament[] = []
  for (let page = 0; ; page++) {
    const result = await fetchTournaments(page, signal, 100, scope)
    rows.push(...result.items)
    if (page + 1 >= result.totalPages) return rows
  }
}
export async function fetchTournament(id: number, signal?: AbortSignal): Promise<Tournament> {
  return read(await teamFetch(`/api/v1/tournaments/${id}`, { signal }))
}
export async function saveTournament(draft: TournamentDraft, existing: Tournament | null, signal?: AbortSignal): Promise<Tournament> {
  return read(await teamFetch(existing ? `/api/v1/tournaments/${existing.id}` : '/api/v1/tournaments', {
    method: existing ? 'PUT' : 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...draft, name: draft.name.trim(), venue: draft.venue.trim(), division: draft.division.trim(), notes: draft.notes.trim(), ...(existing ? { version: existing.version } : {}) }),
  }))
}
