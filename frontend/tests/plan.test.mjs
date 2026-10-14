import test from 'node:test'
import assert from 'node:assert/strict'
import { placeInPlan, checkPlan, plannedShare } from '../src/features/matches/plan.ts'

const entry = (playerId, slot = 'ST', entryOrder = 0, quarterNumber = 1, team = 'A') => ({ team, quarterNumber, slot, entryOrder, playerId })
test('moving and swapping preserve one place per player and other quarters', () => {
  const source = [entry(1), entry(2, 'GK'), entry(1, 'ST', 0, 2)]
  const swapped = placeInPlan(source, 1, 'GK', 0, 1)
  assert.equal(swapped.find(a => a.quarterNumber === 1 && a.slot === 'ST').playerId, 2)
  assert.equal(swapped.find(a => a.quarterNumber === 1 && a.slot === 'GK').playerId, 1)
  assert.deepEqual(swapped.find(a => a.quarterNumber === 2), source[2])
  assert.deepEqual(source[0], entry(1))
  const moved = placeInPlan(swapped, 1, 'LW', 0, 1)
  assert.equal(moved.filter(a => a.quarterNumber === 1 && a.playerId === 1).length, 1)
  assert.equal(moved.some(a => a.quarterNumber === 1 && a.slot === 'GK'), false)
})
test('replacing with a bench player releases the old player; same-slot assignment is stable', () => {
  assert.deepEqual(placeInPlan([entry(1)], 1, 'ST', 0, 2), [entry(2)])
  assert.deepEqual(placeInPlan([entry(1)], 1, 'ST', 0, 1), [entry(1)])
})
test('substitutions credit each player one half and cannot be left without a starter', () => {
  const plan = [entry(1), entry(2, 'ST', 1)]
  assert.equal(plannedShare(plan, plan[0]), 0.5)
  assert.equal(plannedShare(plan, plan[1]), 0.5)
  assert.equal(plannedShare([entry(1)], entry(1)), 1)
  assert.throws(() => placeInPlan(plan, 1, 'GK', 0, 1), /선발/)
  assert.throws(() => placeInPlan([], 1, 'GK', 1, 1), /선발/)
  assert.doesNotThrow(() => placeInPlan(plan, 1, 'ST', 1, 1))
})
test('duplicate places and duplicate players are rejected', () => {
  assert.throws(() => checkPlan([entry(1), entry(1, 'GK')]), /중복/)
  assert.throws(() => checkPlan([entry(1), entry(2)]), /중복/)
})
test('internal teams share slots but never players in the same quarter, and count substitutions within a team', () => {
  const plan = [entry(1), entry(2, 'ST', 0, 1, 'B'), entry(3, 'ST', 1, 1, 'B')]
  assert.doesNotThrow(() => checkPlan(plan))
  assert.equal(plannedShare(plan, plan[0]), 1)
  assert.equal(plannedShare(plan, plan[1]), 0.5)
  assert.equal(plannedShare(plan, plan[2]), 0.5)
  assert.throws(() => checkPlan([...plan, entry(1, 'GK', 0, 1, 'B')]), /중복/)
  assert.throws(() => checkPlan([entry(1), entry(2, 'ST', 1, 1, 'B')]), /선발/)
  assert.throws(() => placeInPlan(plan, 1, 'GK', 0, 1, 'B'), /다른 팀/)
  const moved = placeInPlan(plan, 1, 'GK', 0, 3, 'B')
  assert.deepEqual(moved.find(a => a.playerId === 1), plan[0])
  assert.equal(moved.find(a => a.playerId === 3).team, 'B')
  assert.doesNotThrow(() => checkPlan([...plan, entry(1, 'ST', 0, 2, 'B')]))
})
