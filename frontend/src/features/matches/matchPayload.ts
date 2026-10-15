import type { MatchDraft, MatchRecord } from './api'
import { normalizeFormation } from './formations.ts'

// A retry must serialize the frozen draft and original version, never current form state.
export function toMatchPayload(draft: MatchDraft, existing: MatchRecord | null) {
  return {
    kind: draft.kind, formationA: normalizeFormation(draft.formationA), formationB: normalizeFormation(draft.formationB),
    ...(draft.matchFormat === undefined ? {} : { matchFormat: draft.matchFormat }),
    playedOn: draft.playedOn, kickoff: draft.kickoff, venue: draft.venue, opponent: draft.opponent, notes: draft.notes,
    scoreFor: draft.scoreFor, scoreAgainst: draft.scoreAgainst, recordingStage: draft.recordingStage,
    quarters: draft.quarters, plannedLineup: draft.plannedLineup,
    participants: draft.participants.map(({ playerId, vote, attendance, plannedTeam }) => ({ playerId, vote, attendance,
      // Frozen legacy retries must keep their original body. Explicit null clears a team.
      ...(plannedTeam === undefined ? {} : { plannedTeam, plannedTeamSpecified: true }),
    })),
    version: existing?.version ?? null,
    // Omit these keys for a frozen pre-tournament request so its receipt still matches.
    ...(draft.tournamentSelectionSpecified === undefined ? {} : { tournamentSelectionSpecified: draft.tournamentSelectionSpecified }),
    ...(draft.tournamentId === undefined ? {} : { tournamentId: draft.tournamentId }),
    ...(draft.tournamentStage === undefined ? {} : { tournamentStage: draft.tournamentStage }),
  }
}
