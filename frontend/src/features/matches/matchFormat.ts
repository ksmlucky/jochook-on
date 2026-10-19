import type { MatchDraft } from './api'

export const matchFormats = ['FOUR_QUARTERS', 'TWO_HALVES_30'] as const
export type MatchFormat = typeof matchFormats[number]
export const normalizeMatchFormat = (format?: MatchFormat | null): MatchFormat => format === 'TWO_HALVES_30' ? format : 'FOUR_QUARTERS'
export const quarterNumbers = (format?: MatchFormat | null): number[] => normalizeMatchFormat(format) === 'TWO_HALVES_30' ? [1, 2] : [1, 2, 3, 4]
export const quarterLabel = (number: number, format?: MatchFormat | null): string => normalizeMatchFormat(format) === 'TWO_HALVES_30' && number <= 2 ? `${number === 1 ? '전반' : '후반'}(${number}쿼터)` : `${number}쿼터`
export const matchFormatLabel = (format?: MatchFormat | null): string => normalizeMatchFormat(format) === 'TWO_HALVES_30' ? '전·후반 각 30분' : '4쿼터'
export const matchPeriodSummary = (format?: MatchFormat | null): string => normalizeMatchFormat(format) === 'TWO_HALVES_30' ? '전·후반' : '1~4쿼터'
export const hasLaterQuarterRecords = (draft: MatchDraft): boolean => draft.plannedLineup.some(entry => entry.quarterNumber > 2) || draft.quarters.some(quarter => quarter.number > 2 && (quarter.lineup.length > 0 || quarter.goalsAgainst != null))

/** Never turn changing the format into deleting planned lineups or actual goals. */
export function changeMatchFormat(draft: MatchDraft, matchFormat: MatchFormat, savedRecord?: MatchDraft | null): MatchDraft {
  if (draft.kind === 'INTERNAL' && matchFormat !== 'FOUR_QUARTERS') throw new Error('자체전은 4쿼터로 기록해요.')
  if (matchFormat === 'TWO_HALVES_30' && hasLaterQuarterRecords(draft))
    throw new Error('3·4쿼터에 계획 또는 실제 기록이 있어요. 해당 기록을 직접 확인·정리하고 저장한 뒤 전·후반 형식으로 변경해 주세요.')
  if (matchFormat === 'TWO_HALVES_30' && savedRecord && hasLaterQuarterRecords(savedRecord))
    throw new Error('3·4쿼터 기록 정리를 먼저 저장해 주세요. 저장된 기록이 비워진 뒤 전·후반 형식으로 변경할 수 있어요.')
  return { ...draft, matchFormat, quarters: quarterNumbers(matchFormat).map(number => draft.quarters.find(quarter => quarter.number === number) ?? { number, lineup: [] }) }
}

export function validateMatchPeriods(draft: MatchDraft): void {
  const numbers = quarterNumbers(draft.matchFormat)
  if (draft.kind === 'INTERNAL' && normalizeMatchFormat(draft.matchFormat) !== 'FOUR_QUARTERS') throw new Error('자체전은 4쿼터로 기록해요.')
  if (draft.quarters.length !== numbers.length || new Set(draft.quarters.map(quarter => quarter.number)).size !== numbers.length || draft.quarters.some(quarter => !numbers.includes(quarter.number))
    || draft.plannedLineup.some(entry => !numbers.includes(entry.quarterNumber))) throw new Error('경기 형식과 입력된 쿼터가 맞지 않아요. 경기 형식과 배치를 확인해 주세요.')
}
