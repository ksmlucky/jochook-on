import type { MatchKind } from './api'

export function competitionCategory(match: { kind: MatchKind; tournamentId?: number | null }) {
  if (match.kind === 'INTERNAL') return { key: 'internal', label: '자체전' } as const
  return match.tournamentId != null
    ? { key: 'tournament', label: '대회' } as const
    : { key: 'league', label: '리그' } as const
}
