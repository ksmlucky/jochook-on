export const kickoffHours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
export const kickoffMinutes = ['00', '30']
import type { MatchFormat } from './matchFormat'

export function validKickoff(value: string | null): boolean {
  return value !== null && /^(?:[01]\d|2[0-3]):(?:00|30)(?::00)?$/.test(value)
}

// 표시용 종료 시간이다. 쿼터 길이·실제 출전 시간으로 저장하거나 환산하지 않는다.
export function matchTimeRange(value: string | null, matchFormat?: MatchFormat | null): string {
  if (!value) return '시간 미입력'
  const [hours, minutes] = value.split(':').map(Number)
  const durationHours = matchFormat === 'TWO_HALVES_30' ? 1 : 2
  const endHours = (hours + durationHours) % 24
  return `${value.slice(0, 5)}–${hours + durationHours >= 24 ? '다음 날 ' : ''}${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
