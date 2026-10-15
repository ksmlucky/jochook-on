export type CompetitionScope = 'ALL' | 'LEAGUE' | 'TOURNAMENT'
export type CompetitionSelection = {
  competitionScope: CompetitionScope; tournamentId: number | null; tournamentName?: string | null
}
export function competitionFilterValue(scope: CompetitionScope = 'ALL', tournamentId?: number | null): string {
  return tournamentId == null ? scope : `tournament:${tournamentId}`
}
export function competitionSelection(value: string, tournamentName?: string | null): CompetitionSelection {
  if (value === 'ALL' || value === 'LEAGUE' || value === 'TOURNAMENT') return { competitionScope: value, tournamentId: null, tournamentName: null }
  if (/^tournament:[1-9]\d*$/.test(value)) {
    const id = Number(value.slice('tournament:'.length))
    if (Number.isSafeInteger(id)) return { competitionScope: 'TOURNAMENT', tournamentId: id, tournamentName: tournamentName ?? null }
  }
  throw new RangeError('경기 구분을 다시 선택해 주세요.')
}
export function appendCompetitionQuery(query: URLSearchParams, filters: { competitionScope?: CompetitionScope; tournamentId?: number | null }): void {
  const scope = filters.competitionScope ?? 'ALL', id = filters.tournamentId
  if (!['ALL', 'LEAGUE', 'TOURNAMENT'].includes(scope)) throw new RangeError('경기 구분을 다시 선택해 주세요.')
  if (id != null && (!Number.isSafeInteger(id) || id < 1 || scope === 'LEAGUE')) throw new RangeError('대회 선택과 경기 구분을 확인해 주세요.')
  if (scope !== 'ALL') query.set('competitionScope', scope)
  if (id != null) query.set('tournamentId', String(id))
}
