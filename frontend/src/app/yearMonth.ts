export type MonthRangeSelection = { startMonth: string | null; endMonth: string | null }
export type YearMonthSelection = { year: number | null; month: number | null; startMonth?: string | null; endMonth?: string | null }
export type MonthRangeDraft = { startYear: string; startMonthNumber: string; endYear: string; endMonthNumber: string }
export function currentYear(now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(now))
}
export function yearOptions(years: readonly number[], selectedYear: number | null, now = new Date()): number[] {
  return [...new Set([currentYear(now), ...(selectedYear === null ? [] : [selectedYear]), ...years])]
    .filter(year => Number.isInteger(year) && year >= 1000 && year <= 9999).sort((a, b) => b - a)
}
export function appendYearMonthQuery(query: URLSearchParams, period: Partial<YearMonthSelection> = {}): void {
  const { year, month, startMonth, endMonth } = period
  if (startMonth != null || endMonth != null) {
    if (year != null || month != null) throw new RangeError('기간 범위와 단일 연도·월을 함께 선택할 수 없어요.')
    appendMonthRangeQuery(query, { startMonth: startMonth ?? null, endMonth: endMonth ?? null })
    return
  }
  if (year != null && (!Number.isInteger(year) || year < 1000 || year > 9999)) throw new RangeError('연도는 1000~9999 범위로 선택해 주세요.')
  if (month != null && (year == null || !Number.isInteger(month) || month < 1 || month > 12)) throw new RangeError('연도를 먼저 선택하고 월은 1~12 범위로 선택해 주세요.')
  if (year != null) query.set('year', String(year))
  if (month != null) query.set('month', String(month))
}
export function changePeriodYear(period: YearMonthSelection, year: number | null): YearMonthSelection {
  return { year, month: year === null ? null : period.month }
}

export function validateMonthRange(range: MonthRangeSelection): void {
  if (range.startMonth === null && range.endMonth === null) return
  const validMonth = (value: string | null) => typeof value === 'string' && /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value)
  if (!validMonth(range.startMonth) || !validMonth(range.endMonth)) throw new RangeError('시작과 종료 연월을 모두 올바르게 선택해 주세요.')
  if (range.startMonth! > range.endMonth!) throw new RangeError('종료 연월은 시작 연월보다 빠를 수 없어요.')
}
export function appendMonthRangeQuery(query: URLSearchParams, range: MonthRangeSelection): void {
  validateMonthRange(range)
  if (range.startMonth === null || range.endMonth === null) return
  query.set('startMonth', range.startMonth); query.set('endMonth', range.endMonth)
}
export function monthRangeLabel(range: MonthRangeSelection): string {
  validateMonthRange(range)
  if (range.startMonth === null || range.endMonth === null) return '전체 기간'
  const label = (month: string) => `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`
  return range.startMonth === range.endMonth ? label(range.startMonth) : `${label(range.startMonth)} ~ ${label(range.endMonth)}`
}
export function monthRangeDraft(range: MonthRangeSelection): MonthRangeDraft {
  const parts = (value: string | null) => value === null ? ['', ''] : [value.slice(0, 4), String(Number(value.slice(5)))]
  const [startYear, startMonthNumber] = parts(range.startMonth), [endYear, endMonthNumber] = parts(range.endMonth)
  return { startYear, startMonthNumber, endYear, endMonthNumber }
}
export function monthRangeFromDraft(draft: MonthRangeDraft): MonthRangeSelection {
  if (!draft.startYear || !draft.startMonthNumber || !draft.endYear || !draft.endMonthNumber) throw new RangeError('시작·종료 연도와 월을 모두 선택한 뒤 조회해 주세요.')
  const range = { startMonth: `${draft.startYear}-${draft.startMonthNumber.padStart(2, '0')}`, endMonth: `${draft.endYear}-${draft.endMonthNumber.padStart(2, '0')}` }
  validateMonthRange(range)
  return range
}
export function monthRangeYearOptions(years: readonly number[], selectedYears: readonly string[], now = new Date()): number[] {
  const options = yearOptions([...years, ...selectedYears.filter(value => /^[1-9]\d{3}$/.test(value)).map(Number)], null, now)
  const earliest = Math.min(...options), latest = Math.max(...options)
  return Array.from({ length: latest - earliest + 1 }, (_, index) => latest - index)
}
