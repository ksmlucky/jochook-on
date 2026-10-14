import test from 'node:test'
import assert from 'node:assert/strict'
import { actualFromPlan } from '../src/features/matches/plan.ts'

const participant = (playerId, attendance = 'UNCONFIRMED', vote = 'ATTENDING') => ({ playerId, name: `선수${playerId}`, shirtNumber: null, birthYear: null, playerType: playerId === 2 ? 'GUEST' : 'MEMBER', vote, attendance })
const entry = (playerId, entryOrder = 0, quarterNumber = 1) => ({ team: 'A', quarterNumber, slot: 'ST', entryOrder, playerId })
const fixture = () => ({ playedOn: '2026-10-18', kickoff: null, venue: '검증 구장', opponent: '', notes: '기존 메모',
  participants: [participant(1), participant(2, 'LATE'), participant(3, 'ABSENT'), participant(4, 'UNCONFIRMED', 'ABSENT'), participant(5)],
  plannedLineup: [entry(1), entry(2, 1), entry(1, 0, 4)], quarters: [1, 2, 3, 4].map(number => ({ number, lineup: [] })),
})
test('creates actual quarters from the plan and confirms only unconfirmed attending votes, including guests and reserves', () => {
  const draft = fixture(), before = structuredClone(draft), result = actualFromPlan(draft)
  assert.deepEqual(draft, before)
  assert.deepEqual(result.participants.map(p => p.attendance), ['PRESENT', 'LATE', 'ABSENT', 'UNCONFIRMED', 'PRESENT'])
  assert.equal(result.participants[1].playerType, 'GUEST')
  assert.deepEqual(result.quarters[0].lineup, [{ team: 'A', slot: 'ST', playerId: 1, entryOrder: 0, goals: 0, assists: 0 }, { team: 'A', slot: 'ST', playerId: 2, entryOrder: 1, goals: 0, assists: 0 }])
  assert.equal(result.quarters[1].lineup.length, 0)
  assert.equal(result.quarters[3].lineup[0].playerId, 1)
  assert.deepEqual(result.plannedLineup, before.plannedLineup)
  assert.equal(result.notes, '기존 메모')
})
test('protects existing appearances even when goals and assists are still zero', () => {
  const draft = fixture()
  draft.quarters[0].lineup = [{ playerId: 1, slot: 'GK', entryOrder: 0, goals: 0, assists: 0 }]
  const before = structuredClone(draft)
  assert.throws(() => actualFromPlan(draft), /이미 실제 출전/)
  assert.deepEqual(draft, before)
  draft.quarters[0].lineup[0].goals = 3
  assert.throws(() => actualFromPlan(draft), /이미 실제 출전/)
  assert.equal(draft.quarters[0].lineup[0].goals, 3)
})
test('does not convert a player explicitly marked absent or silently replace a missing roster', () => {
  const draft = fixture()
  draft.participants[0].attendance = 'ABSENT'
  assert.throws(() => actualFromPlan(draft), /실제 불참/)
  assert.equal(draft.participants[0].attendance, 'ABSENT')
  draft.participants.shift()
  assert.throws(() => actualFromPlan(draft), /참석 예정 상태/)
})
test('rejects an empty plan and prevents a second copy after actual records exist', () => {
  assert.throws(() => actualFromPlan({ ...fixture(), plannedLineup: [] }), /먼저 배치/)
  assert.throws(() => actualFromPlan(actualFromPlan(fixture())), /이미 실제 출전/)
})
test('copying an internal plan retains both teams and quarter-to-quarter team changes', () => {
  const draft = fixture()
  draft.kind = 'INTERNAL'
  draft.plannedLineup = [entry(1), { ...entry(2), team: 'B' }, { ...entry(1, 0, 2), team: 'B' }]
  const result = actualFromPlan(draft)
  assert.deepEqual(result.quarters[0].lineup.map(a => [a.playerId, a.team]), [[1, 'A'], [2, 'B']])
  assert.equal(result.quarters[1].lineup[0].team, 'B')
  assert.equal(result.participants.length, draft.participants.length)
  assert.throws(() => actualFromPlan({ ...draft, plannedLineup: [entry(1), { ...entry(1), team: 'B' }] }), /중복/)
})
