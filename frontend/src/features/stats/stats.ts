export type StatsKind = 'EXTERNAL' | 'INTERNAL' | 'ALL'
export type RecordScope = 'COMPLETED' | 'RECORDED' | 'ALL'
export type StatsFilters = { year: number; kind: StatsKind; recordScope: RecordScope; includeGuests: boolean }
export type PlayerStats = {
  playerId: number; name: string; shirtNumber: number | null; birthYear: number | null
  playerType: 'MEMBER' | 'GUEST'; active: boolean; firstChoice: string | null
  goals: number; assists: number; appearances: number; attendances: number; creditedQuarters: number
}
export type SeasonStats = StatsFilters & {
  availableYears: number[]; matchCount: number; completedMatchCount: number; legacyMatchCount: number
  inProgressMatchCount: number; items: PlayerStats[]
}
export const statsSorts = {
  goals: '득점 많은 순', assists: '도움 많은 순', creditedQuarters: '출전 쿼터 많은 순',
  appearances: '출전 경기 많은 순', attendances: '실제 참석 많은 순', shirtNumber: '등번호 순', name: '이름 순',
} as const
export type StatsSort = keyof typeof statsSorts
export function koreaYear(now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(now))
}
export function statsQuery(filters: StatsFilters): string {
  return new URLSearchParams({ year: String(filters.year), kind: filters.kind,
    recordScope: filters.recordScope, includeGuests: String(filters.includeGuests) }).toString()
}
function byIdentity(a: PlayerStats, b: PlayerStats): number {
  return (a.shirtNumber ?? 100) - (b.shirtNumber ?? 100)
    || a.name.localeCompare(b.name, 'ko') || a.playerId - b.playerId
}
export function selectStats(items: PlayerStats[], sort: StatsSort, search = ''): PlayerStats[] {
  const term = search.trim().toLocaleLowerCase('ko')
  return items.filter(item => !term || item.name.toLocaleLowerCase('ko').includes(term)
    || (item.shirtNumber !== null && String(item.shirtNumber) === term.replace(/^#/, '')))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'ko') || byIdentity(a, b)
      : sort === 'shirtNumber' ? byIdentity(a, b) : b[sort] - a[sort] || byIdentity(a, b))
}
