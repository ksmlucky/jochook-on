import type { MatchDraft, MatchTeam, Participant } from './api'
import { formationFor, pitchRowsFor } from './formations.ts'
import type { Slot } from './formations'
import { quarterNumbers } from './matchFormat.ts'

export type CompletionReviewTarget = { step: 0 | 2 | 3; quarter?: number; team?: MatchTeam; playerId?: number }
export interface QuarterCompletionReview {
  quarter: number
  team: MatchTeam
  starterCount: number
  requiredCount: number
  missingSlots: Slot[]
}
export interface ScoreCompletionReview {
  team: MatchTeam
  score: number | null
  playerGoals: number
  status: 'unrecorded' | 'matches' | 'differs'
}
export interface CompletionReviewData {
  unconfirmedAttendees: Participant[]
  quarters: QuarterCompletionReview[]
  attendeesWithoutAppearance: Participant[]
  scoreInput: 'unrecorded' | 'partial' | 'recorded'
  scores: ScoreCompletionReview[]
}

function byShirtNumber(a: Participant, b: Participant) {
  return (a.shirtNumber ?? 100) - (b.shirtNumber ?? 100)
    || a.name.localeCompare(b.name, 'ko') || a.playerId - b.playerId
}

/** Advisory only: this analysis neither changes the draft nor decides if it may be saved. */
export function analyzeCompletion(draft: MatchDraft): CompletionReviewData {
  const teams: MatchTeam[] = draft.kind === 'INTERNAL' ? ['A', 'B'] : ['A']
  const periodNumbers = quarterNumbers(draft.matchFormat)
  const actualEntries = draft.quarters
    .filter(quarter => periodNumbers.includes(quarter.number))
    .flatMap(quarter => quarter.lineup.filter(entry => teams.includes(entry.team)))
  const appeared = new Set(actualEntries.map(entry => entry.playerId))
  const quarters = periodNumbers.flatMap(quarter => teams.map(team => {
    const slots = pitchRowsFor(formationFor(draft, team)).flat()
    const starters = new Set(draft.quarters.find(item => item.number === quarter)?.lineup
      .filter(entry => entry.team === team && entry.entryOrder === 0 && slots.includes(entry.slot))
      .map(entry => entry.slot) ?? [])
    return { quarter, team, starterCount: starters.size, requiredCount: slots.length,
      missingSlots: slots.filter(slot => !starters.has(slot)) }
  }))
  const scores = teams.map(team => {
    const score = team === 'A' ? draft.scoreFor : draft.scoreAgainst
    const playerGoals = actualEntries.filter(entry => entry.team === team).reduce((sum, entry) => sum + entry.goals, 0)
    const status: ScoreCompletionReview['status'] = score === null ? 'unrecorded' : score === playerGoals ? 'matches' : 'differs'
    return { team, score, playerGoals, status }
  })
  return {
    unconfirmedAttendees: draft.participants.filter(player => player.vote === 'ATTENDING' && player.attendance === 'UNCONFIRMED').sort(byShirtNumber),
    quarters,
    attendeesWithoutAppearance: draft.participants.filter(player => ['PRESENT', 'LATE'].includes(player.attendance) && !appeared.has(player.playerId)).sort(byShirtNumber),
    scoreInput: draft.scoreFor === null && draft.scoreAgainst === null ? 'unrecorded'
      : draft.scoreFor === null || draft.scoreAgainst === null ? 'partial' : 'recorded',
    scores,
  }
}
