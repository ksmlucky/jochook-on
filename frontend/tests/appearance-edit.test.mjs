import test from 'node:test'
import assert from 'node:assert/strict'
import { editActualAppearance } from '../src/features/matches/appearanceEdit.ts'

const entry = (playerId, options = {}) => ({ playerId, team: 'A', slot: 'ST', entryOrder: 0, goals: 0, assists: 0, ...options })
const participant = (playerId, attendance = 'PRESENT') => ({ playerId, name: `테스트 선수 ${playerId}`, shirtNumber: playerId, birthYear: 1996, vote: 'ATTENDING', attendance, playerType: 'MEMBER' })
const people = [participant(1), participant(2, 'LATE'), participant(3, 'UNCONFIRMED'), participant(4, 'ABSENT')]
const quarters = (lineup = []) => [{ number: 1, lineup }, { number: 2, lineup: [entry(1)] }, { number: 3, lineup: [] }, { number: 4, lineup: [] }]
const edit = (source, patch, options = {}) => editActualAppearance(source, people, options.quarter ?? 1, options.team ?? 'A', options.slot ?? 'ST', options.order ?? 0, patch)

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

test('assigning an attending or late player defaults stats and preserves all other quarters and teams', () => {
  const source = freeze(quarters([entry(1, { team: 'B', slot: 'GK', goals: 2 })]))
  const before = structuredClone(source)
  const result = edit(source, { playerId: 2 })
  assert.deepEqual(result[0].lineup, [source[0].lineup[0], entry(2)])
  assert.equal(result[0].lineup[0], source[0].lineup[0])
  assert.equal(result[1], source[1])
  assert.deepEqual(source, before)
  assert.deepEqual(edit(quarters(), { playerId: 1 })[0].lineup, [entry(1)])
})

test('invalid, missing, and duplicated quarter numbers cannot silently edit another quarter', () => {
  for (const number of [0, 5, 1.5, NaN, Infinity, '1']) {
    assert.throws(() => edit(quarters(), { playerId: 1 }, { quarter: number }), /쿼터/)
  }
  assert.throws(() => edit([{ number: 2, lineup: [] }], { playerId: 1 }), /쿼터/)
  assert.throws(() => edit([{ number: 1, lineup: [] }, { number: 1, lineup: [] }], { playerId: 1 }), /쿼터/)
})

test('the same player cannot occupy another slot or either team in one quarter', () => {
  for (const first of [entry(1, { slot: 'GK' }), entry(1, { team: 'B' })]) {
    assert.throws(() => edit(quarters([first]), { playerId: 1 }), /같은 쿼터/)
  }
  const result = edit(quarters([entry(1)]), { playerId: 1, goals: 1 })
  assert.equal(result[0].lineup.length, 1)
  assert.equal(result[0].lineup[0].goals, 1)
  assert.equal(result[1].lineup[0].playerId, 1)
})

test('a substitute requires a starter in the same team and slot', () => {
  assert.throws(() => edit(quarters(), { playerId: 2 }, { order: 1 }), /선발/)
  assert.throws(() => edit(quarters([entry(1, { team: 'B' })]), { playerId: 2 }, { order: 1 }), /선발/)
  assert.throws(() => edit(quarters([entry(1, { slot: 'GK' })]), { playerId: 2 }, { order: 1 }), /선발/)
  const source = quarters([entry(1)])
  assert.deepEqual(edit(source, { playerId: 2 }, { order: 1 })[0].lineup, [entry(1), entry(2, { entryOrder: 1 })])
})

test('a starter cannot be cleared while its substitute remains; remove the substitute first', () => {
  const source = quarters([entry(1), entry(2, { entryOrder: 1 })])
  assert.throws(() => edit(source, null), /교체/)
  const noSub = edit(source, null, { order: 1 })
  assert.deepEqual(noSub[0].lineup, [entry(1)])
  assert.deepEqual(edit(noSub, null)[0].lineup, [])
  const otherTeamSub = quarters([entry(1), entry(2, { team: 'B', entryOrder: 1 })])
  assert.deepEqual(edit(otherTeamSub, null)[0].lineup, [entry(2, { team: 'B', entryOrder: 1 })])
})

test('scorer and assister identities remain protected until stats are separately corrected to zero', () => {
  for (const stats of [{ goals: 1 }, { assists: 1 }]) {
    const source = freeze(quarters([entry(1, stats)]))
    assert.throws(() => edit(source, null), /득점·도움/)
    assert.throws(() => edit(source, { playerId: 2 }), /득점·도움/)
    assert.throws(() => edit(source, { playerId: 2, goals: 0, assists: 0 }), /득점·도움/)
    const corrected = edit(source, { goals: 0, assists: 0 })
    assert.deepEqual(edit(corrected, { playerId: 2 })[0].lineup, [entry(2)])
    assert.deepEqual(edit(corrected, null)[0].lineup, [])
  }
})

test('substitute goals also prevent its identity replacement or removal', () => {
  const source = quarters([entry(1), entry(2, { entryOrder: 1, goals: 1 })])
  assert.throws(() => edit(source, null, { order: 1 }), /득점·도움/)
  assert.throws(() => edit(source, { playerId: 3 }, { order: 1 }), /득점·도움/)
  const result = edit(source, { assists: 1 }, { order: 1 })
  assert.equal(result[0].lineup.find(item => item.entryOrder === 1).goals, 1)
  assert.equal(result[0].lineup.find(item => item.entryOrder === 1).assists, 1)
})

test('new assignments require actual attendance, while existing unconfirmed records remain editable', () => {
  for (const playerId of [3, 4, 99]) {
    assert.throws(() => edit(quarters(), { playerId }), /실제 출석/)
    assert.throws(() => edit(quarters([entry(1)]), { playerId }), /실제 출석/)
  }
  for (const playerId of [3, 4]) {
    const result = edit(quarters([entry(playerId)]), { playerId, goals: 1, assists: 1 })
    assert.deepEqual(result[0].lineup, [entry(playerId, { goals: 1, assists: 1 })])
  }
})

test('empty positions cannot create player zero through stats-only or empty patches', () => {
  for (const patch of [{ goals: 1 }, { assists: 0 }, {}, { playerId: 0 }, { playerId: -1 }, { playerId: 1.5 }, { playerId: NaN }, { playerId: Infinity }, { playerId: '' }, { playerId: '1' }, { playerId: null }, { playerId: undefined }]) {
    assert.throws(() => edit(quarters(), patch), /선수/)
  }
  assert.throws(() => edit(quarters([entry(1)]), { playerId: undefined }), /선수/)
})

test('each stat rejects non-numeric, fractional, infinite, blank, and out-of-range values without coercion', () => {
  const source = freeze(quarters([entry(1)]))
  for (const field of ['goals', 'assists']) {
    for (const value of ['', '0', null, undefined, NaN, Infinity, -Infinity, -1, 100, 0.5, true]) {
      assert.throws(() => edit(source, { [field]: value }), /0~99/)
    }
    for (const value of [0, 99]) {
      assert.equal(edit(source, { [field]: value })[0].lineup[0][field], value)
    }
  }
  assert.deepEqual(source[0].lineup, [entry(1)])
})

test('patch metadata cannot move the entry to another team, position, or starter/substitute order', () => {
  const result = edit(quarters(), { playerId: 1, team: 'B', slot: 'GK', entryOrder: 1, goals: 2 })
  assert.deepEqual(result[0].lineup, [entry(1, { goals: 2 })])
  const source = quarters([entry(1, { team: 'B' })])
  const sub = edit(source, { playerId: 2, team: 'A', slot: 'LW', entryOrder: 0 }, { team: 'B', order: 1 })
  assert.deepEqual(sub[0].lineup, [entry(1, { team: 'B' }), entry(2, { team: 'B', entryOrder: 1 })])
})

test('clearing an already empty position is a no-op and never removes the other team', () => {
  const source = freeze(quarters([entry(1, { team: 'B' })]))
  assert.equal(edit(source, null), source)
})
