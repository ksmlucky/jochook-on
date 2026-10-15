import { seoulYear } from './age.ts'

export type ShirtAssignment = { id: number; shirtNumber: number | null }

export function birthYearOptions(referenceYear = seoulYear()): number[] {
  const latest = referenceYear - 17
  return Array.from({ length: Math.max(0, latest - 1950 + 1) }, (_, index) => latest - index)
}
export function validBirthYearInput(value: string, referenceYear = seoulYear()): boolean {
  return value === '' || /^\d{4}$/.test(value) && Number(value) >= 1900 && Number(value) <= referenceYear
}
export function parseShirtNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const number = Number(trimmed)
  return Number.isSafeInteger(number) && number >= 1 && number <= 99 ? number : null
}
export function validShirtNumberInput(value: string): boolean {
  return value.trim() === '' || parseShirtNumber(value) !== null
}
export function availableShirtNumbers(roster: readonly ShirtAssignment[], excludedPlayerId?: number, otherRows: readonly string[] = []): number[] {
  const occupied = new Set(roster.filter(player => player.id !== excludedPlayerId).map(player => player.shirtNumber))
  otherRows.forEach(value => { const number = parseShirtNumber(value); if (number !== null) occupied.add(number) })
  return Array.from({ length: 99 }, (_, index) => index + 1).filter(number => !occupied.has(number))
}
export function availableShirtNumbersForRow(roster: readonly ShirtAssignment[], rows: readonly { key: string; shirtNumber: string }[], rowKey: string): number[] {
  return availableShirtNumbers(roster, undefined, rows.filter(row => row.key !== rowKey).map(row => row.shirtNumber))
}
