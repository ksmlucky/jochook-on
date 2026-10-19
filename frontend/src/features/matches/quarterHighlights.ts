import type { MatchRecord, MatchTeam } from './api'
import { quarterLabel } from './matchFormat.ts'

/** Legacy totals have no scorer/assist pairing; never invent that relationship. */
export function quarterHighlights(record: MatchRecord) {
  const name = (id: number) => {
    const player = record.participants.find(p => p.playerId === id)
    return player ? `${player.shirtNumber == null ? '' : `#${player.shirtNumber} `}${player.name}` : '선수 확인 필요'
  }
  return [...record.quarters].sort((a, b) => a.number - b.number).map(q => ({
    number: q.number, label: quarterLabel(q.number, record.matchFormat),
    teams: (record.kind === 'INTERNAL' ? ['A', 'B'] as const : ['A'] as const).map((team: MatchTeam) => {
      const lineup = q.lineup.filter(a => a.team === team)
      const linked = Array.isArray(q.goalEvents)
      const lines = linked ? q.goalEvents!.filter(e => e.team === team).map(e =>
        `${name(e.scorerId)} 골${e.type === 'FREE_KICK' ? ' (프리킥)' : e.type === 'PENALTY' ? ' (페널티킥)' : ''}${e.assistId == null ? '' : ` · ${name(e.assistId)} 도움`}`)
        : lineup.filter(a => a.goals || a.assists).map(a => `${name(a.playerId)} · ${[a.goals ? `${a.goals}골` : '', a.assists ? `${a.assists}도움` : ''].filter(Boolean).join(' · ')}`)
      const conceded = record.kind === 'INTERNAL' ? q.lineup.filter(a => a.team !== team).reduce((sum, a) => sum + a.goals, 0) : q.goalsAgainst ?? null
      return { team, lines, conceded, unlinked: !linked && lines.length > 0 }
    }),
  }))
}
