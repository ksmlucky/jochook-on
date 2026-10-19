import type { MatchTeam, Quarter } from './api'
import { goalBreakdownError, preserveGoalBreakdown } from './goalBreakdown.ts'
import { quarterNumbers } from './matchFormat.ts'
import type { MatchFormat } from './matchFormat'

export function workbookQuarters(current: Quarter[], imported: Quarter[], team: MatchTeam, matchFormat?: MatchFormat | null): Quarter[] {
  if (current.some(q => Array.isArray(q.goalEvents))) throw new Error('골별 기록을 사용하는 경기에서는 엑셀로 덮어쓸 수 없어요. 작전판과 골별 기록에서 수정해 주세요.')
  if (imported.some(quarter => !quarterNumbers(matchFormat).includes(quarter.number))) throw new Error('엑셀에 현재 경기 형식에 없는 쿼터가 있어요. 경기 형식에 맞는 양식을 사용해 주세요.')
  return current.map(quarter => {
    const lineup = (imported.find(item => item.number === quarter.number)?.lineup ?? []).map(entry => {
      const next = preserveGoalBreakdown({ ...entry, team }, quarter.lineup.find(previous => previous.playerId === entry.playerId))
      const error = goalBreakdownError(next)
      if (error) throw new Error(`${quarter.number}쿼터 엑셀 기록: ${error} 기존 세부 득점을 유지했으니 새 양식에서 함께 확인해 주세요.`)
      return next
    })
    return { ...quarter, lineup: [...quarter.lineup.filter(entry => entry.team !== team), ...lineup] }
  })
}
