import type { MatchDraft, MatchRecord } from './api'
import { normalizeFormation } from './formations.ts'

// A retry must serialize the frozen draft and original version, never current form state.
export function toMatchPayload(draft: MatchDraft, existing: MatchRecord | null) {
  return {
    kind: draft.kind, formationA: normalizeFormation(draft.formationA), formationB: normalizeFormation(draft.formationB),
    playedOn: draft.playedOn, kickoff: draft.kickoff, venue: draft.venue, opponent: draft.opponent, notes: draft.notes,
    scoreFor: draft.scoreFor, scoreAgainst: draft.scoreAgainst, recordingStage: draft.recordingStage,
    quarters: draft.quarters, plannedLineup: draft.plannedLineup,
    participants: draft.participants.map(({ playerId, vote, attendance }) => ({ playerId, vote, attendance })),
    version: existing?.version ?? null,
  }
}
