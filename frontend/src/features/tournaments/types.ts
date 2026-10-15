export interface Tournament {
  id: number; version: number; name: string; startDate: string; endDate: string
  venue: string; division: string; notes: string; matchCount: number
}
export type TournamentDraft = Pick<Tournament, 'name' | 'startDate' | 'endDate' | 'venue' | 'division' | 'notes'>
export interface TournamentPage { items: Tournament[]; page: number; totalPages: number; totalElements: number }
export const emptyTournament = (): TournamentDraft => ({ name: '', startDate: '', endDate: '', venue: '', division: '', notes: '' })
export function tournamentDraft(value: Tournament): TournamentDraft {
  return { name: value.name, startDate: value.startDate, endDate: value.endDate, venue: value.venue, division: value.division, notes: value.notes }
}
export function tournamentDateRange(value: Pick<Tournament, 'startDate' | 'endDate'>): string {
  return value.startDate === value.endDate ? value.startDate : `${value.startDate} ~ ${value.endDate}`
}
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1000-01-01' || value > '9999-12-31') return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function validateTournament(value: TournamentDraft): Partial<Record<keyof TournamentDraft, string>> {
  const errors: Partial<Record<keyof TournamentDraft, string>> = {}
  if (!value.name.trim()) errors.name = '대회 이름을 입력해 주세요.'
  else if (value.name.trim().length > 120) errors.name = '대회 이름은 120자까지 입력할 수 있어요.'
  if (!validDate(value.startDate)) errors.startDate = '시작일을 올바르게 입력해 주세요.'
  if (!validDate(value.endDate)) errors.endDate = '종료일을 올바르게 입력해 주세요.'
  else if (!errors.startDate && value.endDate < value.startDate) errors.endDate = '종료일은 시작일보다 빠를 수 없어요.'
  if (value.venue.length > 120) errors.venue = '장소는 120자까지 입력할 수 있어요.'
  if (value.division.length > 80) errors.division = '참가 부문은 80자까지 입력할 수 있어요.'
  if (value.notes.length > 3000) errors.notes = '메모는 3,000자까지 입력할 수 있어요.'
  return errors
}
