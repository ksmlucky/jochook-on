export const scoringMetrics = ['goals', 'assists', 'freeKickGoals', 'penaltyGoals'] as const
export type ScoringMetric = typeof scoringMetrics[number]
export const scoringLabels: Record<ScoringMetric, string> = { goals: '득점', assists: '도움', freeKickGoals: 'FK', penaltyGoals: 'PK' }
export const statsDisplayModes = { TOTAL: '누적', PER_QUARTER: '1쿼터당', PER_TWO_QUARTERS: '2쿼터당', PER_THREE_QUARTERS: '3쿼터당', PER_FOUR_QUARTERS: '4쿼터당' } as const
export type StatsDisplayMode = keyof typeof statsDisplayModes
const quarterMultipliers = { PER_QUARTER: 1, PER_TWO_QUARTERS: 2, PER_THREE_QUARTERS: 3, PER_FOUR_QUARTERS: 4 } as const
export type ScoringRecord = { goals: number; assists: number; freeKickGoals?: number | null; penaltyGoals?: number | null; creditedQuarters: number }
const rateFormat = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const countFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

export function isScoringMetric(value: string): value is ScoringMetric {
  return scoringMetrics.some(metric => metric === value)
}
export function scoringValue(record: ScoringRecord, metric: ScoringMetric, mode: StatsDisplayMode = 'TOTAL'): number | null {
  // FK/PK are subsets of goals. Old responses have no breakdown and display zero.
  const count = record[metric] ?? 0
  if (mode === 'TOTAL') return count
  if (!Number.isFinite(record.creditedQuarters) || record.creditedQuarters <= 0) return null
  return count / record.creditedQuarters * quarterMultipliers[mode]
}
export function displayScoringValue(record: ScoringRecord, metric: ScoringMetric, mode: StatsDisplayMode = 'TOTAL'): string {
  const value = scoringValue(record, metric, mode)
  return value === null ? '—' : (mode === 'TOTAL' ? countFormat : rateFormat).format(value)
}
