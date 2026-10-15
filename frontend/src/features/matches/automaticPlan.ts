import type { LineupSuggestion, MatchDraft } from './api'
import type { Formation } from './formations'
import { formationFor } from './formations.ts'
import { checkPlan } from './plan.ts'
import { plannedTeamPlayers, unassignedAttendees } from './internalTeams.ts'
import { normalizeMatchFormat, quarterNumbers } from './matchFormat.ts'
import type { MatchFormat } from './matchFormat'

type Suggest = (playedOn: string, playerIds: number[], matchId: number | null, seed: number, signal: AbortSignal, formation: Formation, matchFormat?: MatchFormat) => Promise<LineupSuggestion>

/** Both independent calls must succeed before the caller replaces the current draft. */
export async function generateMatchPlan(draft: MatchDraft, matchId: number | null, seed: number, signal: AbortSignal, suggest: Suggest): Promise<LineupSuggestion> {
  if (draft.kind !== 'INTERNAL') {
    const result = await suggest(draft.playedOn, draft.participants.filter(p => p.vote === 'ATTENDING').map(p => p.playerId), matchId, seed, signal, formationFor(draft), normalizeMatchFormat(draft.matchFormat))
    if (result.plannedLineup.some(entry => !quarterNumbers(draft.matchFormat).includes(entry.quarterNumber))) throw new Error('자동 편성 결과의 쿼터가 경기 형식과 맞지 않아요. 다시 계산해 주세요.')
    return result
  }
  if (unassignedAttendees(draft.participants).length) throw new Error('01에서 참석 예정 선수의 A·B팀을 모두 배정해 주세요.')
  const groups = (['A', 'B'] as const).map(team => ({ team, players: plannedTeamPlayers(draft.participants, team) }))
  if (groups.some(group => !group.players.length)) throw new Error('A팀과 B팀에 각각 참석 예정 선수를 배정해 주세요.')
  const results: LineupSuggestion[] = []
  for (const { team, players } of groups) {
    signal.throwIfAborted()
    const result = await suggest(draft.playedOn, players.map(p => p.playerId), matchId, seed, signal, formationFor(draft, team), 'FOUR_QUARTERS')
    signal.throwIfAborted()
    const plannedLineup = result.plannedLineup.map(entry => ({ ...entry, team }))
    checkPlan(plannedLineup, draft.participants)
    results.push({ ...result, plannedLineup, warnings: result.warnings.map(warning => `${team}팀 · ${warning}`) })
  }
  const combined = { policyVersion: results.map(result => result.policyVersion).join(' / '), seed,
    plannedLineup: results.flatMap(result => result.plannedLineup), warnings: results.flatMap(result => result.warnings),
    allocations: results.flatMap(result => result.allocations), optimal: results.every(result => result.optimal) }
  checkPlan(combined.plannedLineup, draft.participants)
  return combined
}
