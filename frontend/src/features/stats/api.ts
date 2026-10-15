import { readTeamJson, teamFetch } from '../auth/teamRequest'
import { playerMatchesQuery, statsQuery } from './stats'
import type { PlayerSeasonMatches, SeasonStats, StatsFilters } from './stats'

export class StatsRequestError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export async function fetchSeasonStats(filters: StatsFilters, signal: AbortSignal): Promise<SeasonStats> {
  const response = await teamFetch(`/api/v1/stats/players?${statsQuery(filters)}`, { signal })
  if (!response.ok) throw new Error('선수 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
  return readTeamJson<SeasonStats>(response)
}
export async function fetchPlayerSeasonMatches(playerId: number, filters: StatsFilters, page: number, signal: AbortSignal): Promise<PlayerSeasonMatches> {
  if (!Number.isSafeInteger(playerId) || playerId < 1) throw new Error('선수 정보를 다시 선택해 주세요.')
  const response = await teamFetch(`/api/v1/stats/players/${playerId}/matches?${playerMatchesQuery(filters, page)}`, { signal })
  if (!response.ok) throw new StatsRequestError(response.status === 404
    ? '이 조건에서 선수 기록을 찾지 못했어요. 목록을 새로고침하거나 조회 조건을 다시 확인해 주세요.'
    : '선수의 경기별 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', response.status)
  return readTeamJson<PlayerSeasonMatches>(response)
}
