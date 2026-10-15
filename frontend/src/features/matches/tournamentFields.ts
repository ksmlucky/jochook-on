export const tournamentStageLabels = {
  GROUP: '예선', R16: '16강', QUARTER_FINAL: '8강', SEMI_FINAL: '준결승',
  FINAL: '결승', THIRD_PLACE: '3·4위전', OTHER: '기타',
} as const
export type TournamentStage = keyof typeof tournamentStageLabels

export function outsideTournamentDates(date: string, tournament: { startDate: string; endDate: string } | null): boolean {
  return !!tournament && !!date && (date < tournament.startDate || date > tournament.endDate)
}
