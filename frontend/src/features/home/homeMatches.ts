import type { MatchSummary } from '../matches/api'

// The existing endpoint returns the latest 10 matches by playedOn, then id.
// Unknown legacy stages are deliberately not treated as unfinished records.
export function selectHomeMatches<T extends Pick<MatchSummary, 'recordingStage'>>(items: readonly T[]) {
  const firstPage = items.slice(0, 10)
  return {
    recent: firstPage.slice(0, 3),
    unfinished: firstPage.filter(match => ['ATTENDANCE', 'PLAN', 'ACTUAL', 'RESULT'].includes(match.recordingStage ?? '')).slice(0, 2),
  }
}
