import type { MatchRecord, Quarter } from './api'

export function hasCompleteScoringOrder(q: Quarter, internal: boolean): boolean {
  if (!Array.isArray(q.scoringOrder) || !Array.isArray(q.goalEvents)) return false
  if (!internal && q.goalsAgainst == null) return false
  const goals = q.scoringOrder.filter(n => n >= 0)
  return goals.length === q.goalEvents.length && new Set(goals).size === goals.length
    && goals.every(n => Number.isInteger(n) && n < q.goalEvents!.length)
    && q.scoringOrder.every(n => n === -1 || Number.isInteger(n) && n >= 0)
    && q.scoringOrder.filter(n => n === -1).length === (internal ? 0 : q.goalsAgainst)
}

/** A manually entered final score may include goals with no player/event record (for example an own goal). */
export function reportScoreDifference(match: MatchRecord): { recordedFor: number; recordedAgainst: number } | null {
  if (match.scoreFor == null || match.scoreAgainst == null) return null
  const internal = match.kind === 'INTERNAL'
  if (!internal && match.quarters.some(q => q.goalsAgainst == null)) return null
  const goals = (q: Quarter, side: 'A' | 'B') => Array.isArray(q.goalEvents)
    ? q.goalEvents.filter(e => e.team === side).length : q.lineup.filter(a => a.team === side).reduce((sum, a) => sum + a.goals, 0)
  const recordedFor = match.quarters.reduce((sum, q) => sum + goals(q, 'A'), 0)
  const recordedAgainst = match.quarters.reduce((sum, q) => sum + (internal ? goals(q, 'B') : q.goalsAgainst!), 0)
  return recordedFor !== match.scoreFor || recordedAgainst !== match.scoreAgainst ? { recordedFor, recordedAgainst } : null
}

/** Legacy aggregate assists/FK/PK remain visible without fabricating who assisted a particular goal. */
export function legacyQuarterTotals(q: Quarter) {
  return q.lineup.filter(a => a.goals || a.assists || a.freeKickGoals || a.penaltyGoals)
}

/** Never infer an interleaved timeline or running score from old aggregate totals. */
export function reportTimeline(match: MatchRecord) {
  let home = 0, away = 0, prefixKnown = reportScoreDifference(match) === null
  return [...match.quarters].sort((a, b) => a.number - b.number).map(q => {
    const known = hasCompleteScoringOrder(q, match.kind === 'INTERNAL')
    if (!known) prefixKnown = false
    const entries = known ? q.scoringOrder!.map(index => {
      const event = index < 0 ? null : q.goalEvents![index]
      const side = event?.team ?? 'B'
      if (side === 'A') home++; else away++
      return { event, side, score: prefixKnown ? `${home} : ${away}` : null }
    }) : []
    return { quarter: q, known, entries }
  })
}
