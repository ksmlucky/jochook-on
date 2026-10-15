import { tournamentStageLabels } from '../matches/tournamentFields.ts'
import type { TournamentStage } from '../matches/tournamentFields'
import { appendCompetitionQuery } from '../tournaments/competitionScope.ts'
import type { CompetitionScope, CompetitionSelection } from '../tournaments/competitionScope'
import { isScoringMetric, scoringValue } from './scoringMetrics.ts'
import type { StatsDisplayMode } from './scoringMetrics'
import { appendMonthRangeQuery, monthRangeLabel } from '../../app/yearMonth.ts'
import type { MonthRangeSelection } from '../../app/yearMonth'

export type StatsKind = 'EXTERNAL' | 'INTERNAL' | 'ALL'
export type RecordScope = 'COMPLETED' | 'RECORDED' | 'ALL'
export type StatsFilters = {
  year: number; month?: number | null; startMonth?: string | null; endMonth?: string | null; allTime?: boolean
  kind: StatsKind; recordScope: RecordScope; includeGuests: boolean
  tournamentId?: number | null; tournamentName?: string | null
  competitionScope?: CompetitionScope
}
export type PlayerStats = {
  playerId: number; name: string; shirtNumber: number | null; birthYear: number | null
  playerType: 'MEMBER' | 'GUEST'; active: boolean; firstChoice: string | null
  goals: number; assists: number; appearances: number; attendances: number; creditedQuarters: number
  freeKickGoals?: number | null; penaltyGoals?: number | null
}
export type SeasonStats = StatsFilters & {
  availableYears: number[]; matchCount: number; completedMatchCount: number; legacyMatchCount: number
  inProgressMatchCount: number; items: PlayerStats[]
  goalsAgainst?: number | null; scoredExternalMatchCount?: number; missingExternalScoreCount?: number; excludedInternalMatchCount?: number
  externalMatchCount?: number; internalMatchCount?: number
}
export function concededSummary(data: SeasonStats): { value: number | '—'; note: string } {
  const counted = data.scoredExternalMatchCount ?? 0
  const missing = data.missingExternalScoreCount ?? 0
  const internal = data.excludedInternalMatchCount ?? 0
  return {
    value: counted > 0 && data.goalsAgainst != null ? data.goalsAgainst : '—',
    note: `실점은 매칭(외부 팀과의 경기)만 집계해요.${counted > 0 ? ` ${counted}경기 스코어 합산` : ' 집계할 스코어가 없어요.'}${missing > 0 ? ` · 스코어 미입력 ${missing}경기 제외` : ''}${internal > 0 ? ` · 자체전 ${internal}경기 제외` : ''}`,
  }
}
export type PlayerMatchStats = {
  matchId: number; playedOn: string; kickoff: string | null; opponent: string; venue: string
  matchFormat?: import('../matches/matchFormat').MatchFormat | null
  kind: 'EXTERNAL' | 'INTERNAL'; recordingStage: import('../matches/recordingProgress').RecordingStage | null
  scoreFor: number | null; scoreAgainst: number | null; goals: number; assists: number
  freeKickGoals?: number | null; penaltyGoals?: number | null
  creditedQuarters: number; appeared: boolean; attendance: string | null
  tournamentId?: number | null; tournamentName?: string | null; tournamentStage?: TournamentStage | null
}
export type PlayerSeasonMatches = StatsFilters & {
  player: PlayerStats; page: number; size: number; totalElements: number; totalPages: number; items: PlayerMatchStats[]
}
export const statsSorts = {
  shirtNumber: '등번호', name: '선수', goals: '득점', assists: '도움', freeKickGoals: 'FK', penaltyGoals: 'PK',
  appearances: '출전 경기', creditedQuarters: '출전 쿼터', attendances: '출석 (회)',
} as const
export type StatsSort = keyof typeof statsSorts
export type StatsSortDirection = 'asc' | 'desc'
export function defaultStatsSortDirection(sort: StatsSort): StatsSortDirection {
  return sort === 'shirtNumber' || sort === 'name' ? 'asc' : 'desc'
}
export function koreaYear(now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(now))
}
export function defaultStatsFilters(now = new Date()): StatsFilters {
  return { year: koreaYear(now), kind: 'ALL', recordScope: 'COMPLETED', includeGuests: false, competitionScope: 'ALL' }
}
export function statsYearOptions(availableYears: number[], selectedYear: number, now = new Date()): number[] {
  return [...new Set([koreaYear(now), selectedYear, ...availableYears])].sort((a, b) => b - a)
}
export function statsQuery(filters: StatsFilters): string {
  if (filters.kind === 'INTERNAL' && (filters.competitionScope === 'TOURNAMENT' || filters.tournamentId != null)) throw new RangeError('자체전은 대회로 구분하지 않아요.')
  if (filters.allTime) {
    if (filters.month != null || filters.startMonth != null || filters.endMonth != null) throw new RangeError('전체 기간과 기간 범위를 함께 지정할 수 없어요.')
    const query = new URLSearchParams({ allTime: 'true', kind: filters.kind, recordScope: filters.recordScope, includeGuests: String(filters.includeGuests) })
    appendCompetitionQuery(query, filters)
    return query.toString()
  }
  if (filters.startMonth != null || filters.endMonth != null) {
    if (filters.month != null) throw new RangeError('기간과 단일 월을 함께 지정할 수 없어요.')
    const query = new URLSearchParams({ kind: filters.kind, recordScope: filters.recordScope, includeGuests: String(filters.includeGuests) })
    appendMonthRangeQuery(query, { startMonth: filters.startMonth ?? null, endMonth: filters.endMonth ?? null })
    appendCompetitionQuery(query, filters)
    return query.toString()
  }
  const query = new URLSearchParams({ year: String(filters.year), kind: filters.kind,
    recordScope: filters.recordScope, includeGuests: String(filters.includeGuests) })
  if (filters.month != null) {
    if (!Number.isInteger(filters.month) || filters.month < 1 || filters.month > 12) throw new RangeError('월은 1~12 사이로 선택해 주세요.')
    query.set('month', String(filters.month))
  }
  appendCompetitionQuery(query, filters)
  return query.toString()
}
export function statsMonthRange(filters: StatsFilters): MonthRangeSelection {
  if (filters.allTime) return { startMonth: null, endMonth: null }
  if (filters.startMonth != null || filters.endMonth != null) return { startMonth: filters.startMonth ?? null, endMonth: filters.endMonth ?? null }
  const month = filters.month == null ? null : String(filters.month).padStart(2, '0')
  return { startMonth: `${filters.year}-${month ?? '01'}`, endMonth: `${filters.year}-${month ?? '12'}` }
}
export function withStatsRange(filters: StatsFilters, range: MonthRangeSelection): StatsFilters {
  appendMonthRangeQuery(new URLSearchParams(), range)
  return { ...filters, year: range.startMonth ? Number(range.startMonth.slice(0, 4)) : koreaYear(), month: null, ...range, allTime: range.startMonth === null && range.endMonth === null }
}
export function withStatsTournament(filters: StatsFilters, tournamentId: number | null, tournamentName?: string | null): StatsFilters {
  return { ...filters, kind: tournamentId !== null && filters.kind === 'INTERNAL' ? 'ALL' : filters.kind, tournamentId, tournamentName: tournamentId === null ? null : tournamentName ?? null,
    ...(filters.competitionScope !== undefined ? { competitionScope: tournamentId === null ? 'ALL' : 'TOURNAMENT' } : {}) }
}
export function withStatsCompetition(filters: StatsFilters, selection: CompetitionSelection): StatsFilters {
  const tournamentOnly = selection.competitionScope === 'TOURNAMENT' || selection.tournamentId != null
  return { ...filters, ...selection, kind: tournamentOnly && filters.kind === 'INTERNAL' ? 'ALL' : filters.kind,
    tournamentName: selection.tournamentId == null ? null : selection.tournamentName ?? null }
}
export function withStatsKind(filters: StatsFilters, kind: StatsKind): StatsFilters {
  const clearTournament = kind === 'INTERNAL' && (filters.competitionScope === 'TOURNAMENT' || filters.tournamentId != null)
  return clearTournament ? { ...filters, kind, tournamentId: null, tournamentName: null,
    ...(filters.competitionScope !== undefined ? { competitionScope: 'ALL' } : {}) } : { ...filters, kind }
}
export function playerMatchesQuery(filters: StatsFilters, page: number): string {
  if (!Number.isSafeInteger(page) || page < 0) throw new RangeError('경기 목록 페이지는 0 이상의 정수여야 합니다.')
  const query = new URLSearchParams(statsQuery(filters))
  query.set('page', String(page))
  return query.toString()
}
export function statsScopeLabel(filters: StatsFilters): string {
  const tournamentOnly = filters.competitionScope === 'TOURNAMENT' || filters.tournamentId != null
  const kind = filters.kind === 'EXTERNAL' ? '외부 경기만' : filters.kind === 'INTERNAL' ? '자체전만' : tournamentOnly ? '외부 경기' : '전체 경기 · 자체전 포함'
  const scope = filters.recordScope === 'COMPLETED' ? '기록 완료' : filters.recordScope === 'RECORDED' ? '완료 + 이전 기록' : '작성 중 포함'
  const tournament = filters.tournamentId != null ? ` · 대회: ${filters.tournamentName || '선택한 대회'}`
    : filters.competitionScope === 'LEAGUE' ? ' · 리그만' : filters.competitionScope === 'TOURNAMENT' ? ' · 대회만'
      : filters.kind !== 'INTERNAL' ? ' · 리그 + 대회 합산' : ' · 리그'
  const period = filters.allTime ? '전체 기간' : filters.startMonth != null || filters.endMonth != null
    ? monthRangeLabel(statsMonthRange(filters)) : `${filters.year}년${filters.month != null ? ` ${filters.month}월` : ''}`
  return `${period} · ${kind} · ${scope} · ${filters.includeGuests ? '회원과 용병' : '회원'}${tournament}`
}
export function playerMatchTournamentLabel(match: Pick<PlayerMatchStats, 'tournamentId' | 'tournamentName' | 'tournamentStage'>): string | null {
  if (match.tournamentId == null) return null
  const stage = match.tournamentStage ? tournamentStageLabels[match.tournamentStage] : null
  return `${match.tournamentName || '대회 이름 미확인'}${stage ? ` · ${stage}` : ''}`
}
function byIdentity(a: PlayerStats, b: PlayerStats): number {
  return (a.shirtNumber ?? 100) - (b.shirtNumber ?? 100)
    || a.name.localeCompare(b.name, 'ko') || a.playerId - b.playerId
}
export function selectStats(items: PlayerStats[], sort: StatsSort, search = '', displayMode: StatsDisplayMode = 'TOTAL', direction: StatsSortDirection = defaultStatsSortDirection(sort)): PlayerStats[] {
  const term = search.trim().toLocaleLowerCase('ko')
  const order = direction === 'asc' ? 1 : -1
  return items.filter(item => !term || item.name.toLocaleLowerCase('ko').includes(term)
    || (item.shirtNumber !== null && String(item.shirtNumber) === term.replace(/^#/, '')))
    .sort((a, b) => {
      if (sort === 'name') return order * a.name.localeCompare(b.name, 'ko') || byIdentity(a, b)
      if (sort === 'shirtNumber') {
        if (a.shirtNumber === null || b.shirtNumber === null) return a.shirtNumber === b.shirtNumber ? byIdentity(a, b) : a.shirtNumber === null ? 1 : -1
        return order * (a.shirtNumber - b.shirtNumber) || byIdentity(a, b)
      }
      if (isScoringMetric(sort)) {
        const aValue = scoringValue(a, sort, displayMode), bValue = scoringValue(b, sort, displayMode)
        if (aValue === null || bValue === null) return aValue === bValue ? byIdentity(a, b) : aValue === null ? 1 : -1
        return order * (aValue - bValue) || byIdentity(a, b)
      }
      return order * (a[sort] - b[sort]) || byIdentity(a, b)
    })
}
