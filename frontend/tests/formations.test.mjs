import test from 'node:test'
import assert from 'node:assert/strict'
import { changeFormation, formationFor, formationLabel, formationOptions, pitchRowsFor, removedPlanCount, slotGroup, slotPosition, slotLabels } from '../src/features/matches/formations.ts'

const entry = (slot, playerId, team = 'A', quarterNumber = 1, entryOrder = 0) => ({ slot, playerId, team, quarterNumber, entryOrder })
const draft = () => ({ kind: 'INTERNAL', formationA: 'F4123', formationB: 'F4123', participants: [],
  plannedLineup: [entry('GK', 1), entry('LW', 2), entry('LW', 3, 'A', 1, 1), entry('LCM', 4, 'A', 4), entry('ST', 5, 'B')],
  quarters: [1, 2, 3, 4].map(number => ({ number, lineup: [] })) })

test('every supported formation provides eleven distinct positions and exactly one GK', () => {
  assert.equal(formationOptions.length, 6)
  for (const formation of formationOptions) {
    const slots = pitchRowsFor(formation).flat()
    assert.equal(slots.length, 11, formation)
    assert.equal(new Set(slots).size, 11, formation)
    assert.equal(slots.filter(slot => slot === 'GK').length, 1)
  }
  assert.deepEqual(pitchRowsFor('F442')[0], ['LST', 'RST'])
  assert.deepEqual(pitchRowsFor('F4231')[2], ['LCDM', 'RCDM'])
})
test('legacy records retain 4-1-2-3 and A/B formation selection is independent', () => {
  assert.equal(formationFor({}), 'F4123')
  assert.equal(formationLabel(null), '4-1-2-3')
  assert.equal(formationFor({ formationA: 'F442', formationB: 'F4231' }, 'B'), 'F4231')
  assert.equal(formationFor({ formationA: 'F442', formationB: 'F4231' }, 'A'), 'F442')
})
test('confirmed formation changes retain common planned positions, substitutes in common slots and the other team', () => {
  const before = draft()
  before.plannedLineup.push(entry('GK', 6, 'A', 1, 1))
  const snapshot = structuredClone(before)
  assert.equal(removedPlanCount(before, 'A', 'F442'), 2)
  const after = changeFormation(before, 'A', 'F442')
  assert.equal(after.formationA, 'F442')
  assert.equal(after.formationB, 'F4123')
  assert.deepEqual(after.plannedLineup.map(e => e.playerId), [1, 4, 5, 6])
  assert.deepEqual(after.quarters, before.quarters)
  assert.deepEqual(before, snapshot, 'original draft must remain available when cancelling')
})
test('changing formation cannot erase any target-team actual entry, even a zero-stat starter', () => {
  const before = draft()
  before.quarters[2].lineup.push({ team: 'A', slot: 'LW', playerId: 2, entryOrder: 0, goals: 0, assists: 0 })
  const snapshot = structuredClone(before)
  assert.throws(() => changeFormation(before, 'A', 'F442'), /실제 출전 기록/)
  assert.deepEqual(before, snapshot)
  assert.doesNotThrow(() => changeFormation(before, 'B', 'F442'))
  assert.equal(changeFormation(before, 'A', 'F4123'), before)
})
test('positional pairs map to the corresponding preferred position and new midfield roles retain midfield colors', () => {
  for (const slot of ['LCDM', 'RCDM']) assert.equal(slotPosition(slot), 'CDM')
  for (const slot of ['LST', 'RST']) assert.equal(slotPosition(slot), 'ST')
  for (const slot of ['LM', 'RM', 'CAM', 'LCDM', 'RCDM']) assert.equal(slotGroup(slot), 'MF')
  for (const slot of ['LST', 'RST']) assert.equal(slotGroup(slot), 'FW')
})
test('three-back shapes distinguish their defenders and preserve the requested midfield roles', () => {
  for (const formation of ['F352', 'F343']) {
    const slots = pitchRowsFor(formation).flat()
    assert.deepEqual(slots.filter(slot => slotPosition(slot) === 'CB'), ['LCB', 'CCB', 'RCB'])
    assert.equal(slots.includes('LB') || slots.includes('RB'), false)
    for (const slot of ['CCB', 'LWB', 'RWB']) assert.equal(slotGroup(slot), 'DF')
    assert.equal(slotPosition('LWB'), 'LWB')
    assert.equal(slotPosition('RWB'), 'RWB')
  }
  assert.deepEqual(['LCB', 'CCB', 'RCB'].map(slot => slotLabels[slot]), ['LCB', 'CB', 'RCB'])
  assert.deepEqual(pitchRowsFor('F352').flat(), ['LST', 'RST', 'CAM', 'LWB', 'LCM', 'RCM', 'RWB', 'LCB', 'CCB', 'RCB', 'GK'])
  assert.deepEqual(pitchRowsFor('F343').flat(), ['LW', 'ST', 'RW', 'LM', 'LCM', 'RCM', 'RM', 'LCB', 'CCB', 'RCB', 'GK'])
  assert.equal(pitchRowsFor('F352').flat().includes('CDM'), false)
  assert.equal(pitchRowsFor('F343').flat().includes('LWB'), false)
  assert.equal(pitchRowsFor('F343').flat().includes('RWB'), false)
})
test('four-back to three-back changes count all removed plans and preserve common roles in every quarter and the other team', () => {
  const before = draft()
  before.plannedLineup = [1, 2, 3, 4].flatMap(quarter => pitchRowsFor('F4123').flat().map((slot, index) => entry(slot, index + 1, 'A', quarter)))
  before.plannedLineup.push(entry('LW', 12, 'A', 2, 1), entry('LB', 20, 'B'))
  const snapshot = structuredClone(before)
  assert.equal(removedPlanCount(before, 'A', 'F352'), 25)
  const after = changeFormation(before, 'A', 'F352')
  assert.equal(after.plannedLineup.filter(e => e.team === 'A').length, 20)
  for (const quarter of [1, 2, 3, 4]) assert.deepEqual(after.plannedLineup.filter(e => e.team === 'A' && e.quarterNumber === quarter).map(e => e.slot), ['LCM', 'RCM', 'LCB', 'RCB', 'GK'])
  assert.deepEqual(after.plannedLineup.find(e => e.team === 'B'), entry('LB', 20, 'B'))
  assert.deepEqual(before, snapshot, 'preview/cancel must not mutate the current draft')
})
test('a three-back actual record cannot be silently removed by switching to a four-back formation', () => {
  const before = draft()
  before.formationA = 'F343'
  before.quarters[0].lineup = [{ team: 'A', slot: 'CCB', playerId: 1, entryOrder: 0, goals: 2, assists: 1 }]
  const snapshot = structuredClone(before)
  assert.throws(() => changeFormation(before, 'A', 'F442'), /실제 출전 기록/)
  assert.deepEqual(before, snapshot)
})
