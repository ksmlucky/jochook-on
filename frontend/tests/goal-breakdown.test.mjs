import test from 'node:test'
import assert from 'node:assert/strict'
import { goalBreakdownError, generalGoals, sumGoalBreakdown } from '../src/features/matches/goalBreakdown.ts'
import { workbookQuarters } from '../src/features/matches/workbookApply.ts'
import { editActualAppearance } from '../src/features/matches/appearanceEdit.ts'
import { actualFromPlan } from '../src/features/matches/plan.ts'
import { toMatchPayload } from '../src/features/matches/matchPayload.ts'

const entry = (patch = {}) => ({ team: 'A', slot: 'ST', playerId: 1, goals: 3, assists: 0, entryOrder: 0, ...patch })
const quarters = lineup => [1, 2, 3, 4].map(number => ({ number, lineup: number === 1 ? lineup : [] }))
const players = [1, 2].map(playerId => ({ playerId, name: `가상 선수 ${playerId}`, shirtNumber: playerId, birthYear: 1996, playerType: 'MEMBER', vote: 'ATTENDING', attendance: 'PRESENT' }))
const draft = lineup => ({ kind: 'EXTERNAL', playedOn: '2026-10-15', kickoff: '11:00', venue: '', opponent: '', notes: '', scoreFor: null, scoreAgainst: null,
  participants: players, quarters: quarters(lineup), plannedLineup: [{ team: 'A', slot: 'ST', playerId: 1, entryOrder: 0, quarterNumber: 1 }] })

test('goal breakdown is included in total goals, never added again; zero and missing remain valid', () => {
  assert.equal(generalGoals(entry({ freeKickGoals: 1, penaltyGoals: 1 })), 1)
  assert.equal(generalGoals(entry()), 3)
  assert.equal(goalBreakdownError(entry({ freeKickGoals: 1, penaltyGoals: 2 })), null)
  assert.equal(goalBreakdownError(entry({ freeKickGoals: null, penaltyGoals: undefined })), null)
  assert.match(goalBreakdownError(entry({ freeKickGoals: 2, penaltyGoals: 2 })), /총 골/)
  for (const field of ['freeKickGoals', 'penaltyGoals']) for (const value of [-1, 100, .5, NaN, Infinity, '1', true]) {
    assert.match(goalBreakdownError(entry({ [field]: value })), /0~99/)
  }
  assert.deepEqual(sumGoalBreakdown([entry(), entry({ goals: 2, freeKickGoals: 1, penaltyGoals: 1 })]), { goals: 5, freeKickGoals: 1, penaltyGoals: 1 })
})

test('editing unrelated stats preserves starter and substitute breakdown and validates reductions', () => {
  const source = quarters([entry({ freeKickGoals: 1, penaltyGoals: 1 }), entry({ playerId: 2, entryOrder: 1, goals: 1, penaltyGoals: 1 })])
  const before = structuredClone(source)
  const edit = (order, patch) => editActualAppearance(source, players, 1, 'A', 'ST', order, patch)
  assert.deepEqual(edit(0, { assists: 1 })[0].lineup.find(a => a.entryOrder === 0), entry({ freeKickGoals: 1, penaltyGoals: 1, assists: 1 }))
  assert.equal(edit(1, { assists: 1 })[0].lineup.find(a => a.entryOrder === 1).penaltyGoals, 1)
  assert.throws(() => edit(0, { goals: 1 }), /총 골/)
  assert.throws(() => edit(1, { freeKickGoals: 1 }), /총 골/)
  assert.equal(edit(0, { freeKickGoals: 0 })[0].lineup.find(a => a.entryOrder === 0).freeKickGoals, 0)
  assert.equal(edit(0, { freeKickGoals: null })[0].lineup.find(a => a.entryOrder === 0).freeKickGoals, 1)
  assert.deepEqual(source, before)
})

test('old Excel retains unsaved breakdown by quarter/player even after slot or substitution changes', () => {
  const source = quarters([entry({ freeKickGoals: 1, penaltyGoals: 1 }), entry({ playerId: 2, team: 'B', goals: 1, penaltyGoals: 1 })])
  const before = structuredClone(source)
  const imported = quarters([entry({ slot: 'LW', entryOrder: 1, freeKickGoals: null, penaltyGoals: null })])
  imported[1].lineup = [entry({ goals: 0 })]
  const result = workbookQuarters(source, imported, 'A')
  assert.deepEqual(result[0].lineup.find(a => a.team === 'A'), entry({ slot: 'LW', entryOrder: 1, freeKickGoals: 1, penaltyGoals: 1 }))
  assert.equal(result[0].lineup.find(a => a.team === 'B'), source[0].lineup[1])
  assert.equal('freeKickGoals' in result[1].lineup[0], false)
  assert.equal('penaltyGoals' in result[1].lineup[0], false)
  assert.deepEqual(source, before)
})

test('new Excel explicit zero resets breakdown; old Excel cannot silently lower goals below preserved breakdown', () => {
  const source = quarters([entry({ freeKickGoals: 1, penaltyGoals: 1 })])
  const reset = workbookQuarters(source, quarters([entry({ goals: 0, freeKickGoals: 0, penaltyGoals: 0 })]), 'A')
  assert.deepEqual(reset[0].lineup[0], entry({ goals: 0, freeKickGoals: 0, penaltyGoals: 0 }))
  assert.throws(() => workbookQuarters(source, quarters([entry({ goals: 1 })]), 'A'), /1쿼터 엑셀 기록.*총 골/)
  assert.equal(source[0].lineup[0].goals, 3)
})

test('old Excel imports to the selected B team, protecting other team and matching only the same quarter', () => {
  const source = quarters([entry({ playerId: 2, team: 'A', goals: 1, freeKickGoals: 1 }), entry({ team: 'B', penaltyGoals: 2 })])
  const result = workbookQuarters(source, quarters([entry({ freeKickGoals: null, penaltyGoals: null })]), 'B')
  assert.equal(result[0].lineup[0], source[0].lineup[0])
  assert.equal(result[0].lineup[1].team, 'B')
  assert.equal(result[0].lineup[1].penaltyGoals, 2)
  assert.equal(result[0].lineup[1].freeKickGoals, null)
})

test('payload leaves legacy missing/null fields untouched and respects explicit zero without changing receipt body', () => {
  for (const fields of [{}, { freeKickGoals: null, penaltyGoals: null }, { freeKickGoals: 0, penaltyGoals: 0 }, { freeKickGoals: 1, penaltyGoals: 1 }]) {
    const value = draft([entry(fields)]), before = JSON.stringify(value.quarters)
    const payload = toMatchPayload(value, null)
    assert.equal(JSON.stringify(payload.quarters), before)
  }
  const changed = editActualAppearance(quarters([entry()]), players, 1, 'A', 'ST', 0, { assists: 1 })
  assert.equal('freeKickGoals' in changed[0].lineup[0], false)
  assert.equal('penaltyGoals' in changed[0].lineup[0], false)
})

test('copying the plan only creates empty stats and never replaces actual FK/PK records', () => {
  const source = draft([entry({ freeKickGoals: 1, penaltyGoals: 1 })]), before = structuredClone(source)
  assert.throws(() => actualFromPlan(source), /이미 실제 출전/)
  assert.deepEqual(source, before)
  const copied = actualFromPlan(draft([])).quarters[0].lineup[0]
  assert.equal(copied.goals, 0)
  assert.equal(generalGoals(copied), 0)
  assert.equal(goalBreakdownError(copied), null)
})
