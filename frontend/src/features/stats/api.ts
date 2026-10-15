import { readTeamJson, teamFetch } from '../auth/teamRequest'
import { statsQuery } from './stats'
import type { SeasonStats, StatsFilters } from './stats'

export async function fetchSeasonStats(filters: StatsFilters, signal: AbortSignal): Promise<SeasonStats> {
  const response = await teamFetch(`/api/v1/stats/players?${statsQuery(filters)}`, { signal })
  if (!response.ok) throw new Error('선수 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
  return readTeamJson<SeasonStats>(response)
}
