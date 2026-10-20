import type { GoalEvent, Quarter } from './api'

/** A known order covers every scored/conceded event exactly once. Null never implies chronology. */
export function validScoringOrder(quarter: Quarter, internal: boolean): boolean {
  const order = quarter.scoringOrder, goals = quarter.goalEvents
  if (!Array.isArray(order) || !Array.isArray(goals) || goals.length > 1000 || order.length > 1099) return false
  if (!internal && (!Number.isInteger(quarter.goalsAgainst) || quarter.goalsAgainst == null || quarter.goalsAgainst < 0 || quarter.goalsAgainst > 99)) return false
  const seen = new Set<number>()
  let conceded = 0
  for (const index of order) {
    if (index === -1) { conceded++; continue }
    if (!Number.isInteger(index) || index < 0 || index >= goals.length || seen.has(index)) return false
    seen.add(index)
  }
  return seen.size === goals.length && conceded === (internal ? 0 : quarter.goalsAgainst)
}

function equalGoals(a: GoalEvent[] | null | undefined, b: GoalEvent[] | null | undefined) {
  if (a == null || b == null) return a == null && b == null
  return a.length === b.length && a.every((goal, i) => goal.scorerId === b[i].scorerId && goal.assistId === b[i].assistId
    && goal.type === b[i].type && goal.team === b[i].team)
}

/** Reconfirm after a source edit rather than silently attaching old indexes to different goals. */
export function invalidateChangedScoringOrder(previous: Quarter, next: Quarter): Quarter {
  const changed = !equalGoals(previous.goalEvents, next.goalEvents) || (previous.goalsAgainst ?? null) !== (next.goalsAgainst ?? null)
  return changed && previous.scoringOrder != null
    ? { ...next, scoringOrder: null, scoringOrderSpecified: true } : next
}

/** Only a proposed editing list; callers must require explicit confirmation before storing it. */
export function scoringOrderCandidates(quarter: Quarter, internal: boolean): number[] {
  return [...(quarter.goalEvents ?? []).map((_, index) => index), ...Array.from({ length: internal ? 0 : Math.min(99, Math.max(0, Math.floor(quarter.goalsAgainst ?? 0))) }, () => -1)]
}

export function moveScoringEvent(order: number[], index: number, direction: -1 | 1): number[] {
  const target = index + direction
  if (!Number.isInteger(index) || index < 0 || index >= order.length || target < 0 || target >= order.length) return order
  const result = [...order]
  ;[result[index], result[target]] = [result[target], result[index]]
  return result
}
