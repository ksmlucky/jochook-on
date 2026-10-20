import type { GoalEvent, Quarter } from './api'
import { invalidateChangedScoringOrder } from './scoringOrder.ts'

export const goalTypeLabels = { NORMAL: '일반 득점', FREE_KICK: '직접 프리킥', PENALTY: '페널티킥' } as const

/** Events are the single source of stats in linked quarters. Legacy quarters stay untouched. */
export function withGoalEvents(quarter: Quarter, events: GoalEvent[]): Quarter {
  if (events.length > 1000) throw new Error('한 구간에 골별 기록은 1,000개까지 입력할 수 있어요.')
  const lineup = quarter.lineup.map(a => ({ ...a, goals: 0, assists: 0, freeKickGoals: 0, penaltyGoals: 0 }))
  for (const event of events) {
    const scorer = lineup.find(a => a.playerId === event.scorerId && a.team === event.team)
    if (!scorer) throw new Error('득점자는 해당 구간·팀에 배치한 선수 중에서 선택해 주세요.')
    if (!Object.hasOwn(goalTypeLabels, event.type)) throw new Error('득점 유형을 확인해 주세요.')
    scorer.goals++
    if (event.type === 'FREE_KICK') scorer.freeKickGoals++
    if (event.type === 'PENALTY') scorer.penaltyGoals++
    if (event.assistId != null) {
      if (event.assistId === event.scorerId) throw new Error('득점자 본인을 도움 선수로 선택할 수 없어요.')
      if (event.type !== 'NORMAL') throw new Error('직접 프리킥·페널티킥 골에는 도움을 기록하지 않아요.')
      const helper = lineup.find(a => a.playerId === event.assistId && a.team === event.team)
      if (!helper) throw new Error('도움 선수도 같은 구간·팀에 배치한 선수여야 해요.')
      helper.assists++
    }
  }
  if (lineup.some(a => a.goals > 99 || a.assists > 99)) throw new Error('선수별 구간 득점·도움은 각각 99까지 입력할 수 있어요.')
  return invalidateChangedScoringOrder(quarter, { ...quarter, lineup, goalEvents: events.map(e => ({ ...e })) })
}

/** Only known scorer/type data is seeded. Never guess the identity of an assisting player. */
export function seedGoalEvents(quarter: Quarter): GoalEvent[] {
  return quarter.lineup.flatMap(a => Array.from({ length: a.goals }, (_, index) => ({
    scorerId: a.playerId, assistId: null, team: a.team,
    type: index < (a.freeKickGoals ?? 0) ? 'FREE_KICK' as const
      : index < (a.freeKickGoals ?? 0) + (a.penaltyGoals ?? 0) ? 'PENALTY' as const : 'NORMAL' as const,
  })))
}

export function conversionMismatch(quarter: Quarter, events: GoalEvent[]): string | null {
  let linked: Quarter
  try { linked = withGoalEvents(quarter, events) } catch (cause) { return (cause as Error).message }
  return quarter.lineup.some(a => {
    const next = linked.lineup.find(b => b.playerId === a.playerId && b.team === a.team)!
    return a.goals !== next.goals || a.assists !== next.assists || (a.freeKickGoals ?? 0) !== next.freeKickGoals || (a.penaltyGoals ?? 0) !== next.penaltyGoals
  }) ? '기존 골·도움 합계와 일치하도록 도움 선수를 연결해 주세요. 기존 기록은 전환을 완료하기 전까지 그대로 유지돼요.' : null
}
