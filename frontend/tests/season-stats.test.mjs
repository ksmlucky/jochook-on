import test from 'node:test'
import assert from 'node:assert/strict'
import { koreaYear, selectStats, statsQuery } from '../src/features/stats/stats.ts'

const player = (playerId, shirtNumber, goals, extra = {}) => ({ playerId, shirtNumber, goals, name: `가상 선수 ${playerId}`, assists: 0, appearances: 0, attendances: 0, creditedQuarters: 0, playerType: 'MEMBER', active: true, birthYear: null, firstChoice: null, ...extra })
test('season defaults use Korea calendar year at UTC boundary', () => {
  assert.equal(koreaYear(new Date('2025-12-31T14:59:59Z')), 2025)
  assert.equal(koreaYear(new Date('2025-12-31T15:00:00Z')), 2026)
})
test('stats query keeps completion, guests and match kind independent', () => {
  const query = new URLSearchParams(statsQuery({ year: 2026, kind: 'INTERNAL', recordScope: 'RECORDED', includeGuests: true }))
  assert.deepEqual(Object.fromEntries(query), { year: '2026', kind: 'INTERNAL', recordScope: 'RECORDED', includeGuests: 'true' })
})
test('ties sort by actual shirt number then identity; null number comes last without changing source', () => {
  const rows = [player(8, null, 2), player(9, 23, 2), player(2, 2, 2), player(1, 1, 0)]
  assert.deepEqual(selectStats(rows, 'goals').map(row => row.playerId), [2, 9, 8, 1])
  assert.deepEqual(rows.map(row => row.playerId), [8, 9, 2, 1])
})
test('half quarter statistics retain their numeric ordering and search does not invent a number', () => {
  const rows = [player(1, 1, 0, { creditedQuarters: 3.5 }), player(2, null, 0, { creditedQuarters: 4 }), player(3, 11, 0, { creditedQuarters: 1 })]
  assert.deepEqual(selectStats(rows, 'creditedQuarters').map(row => row.playerId), [2, 1, 3])
  assert.deepEqual(selectStats(rows, 'shirtNumber', '#1').map(row => row.playerId), [1])
  assert.deepEqual(selectStats(rows, 'goals', 'null'), [])
  assert.equal(selectStats(rows, 'goals', '가상 선수').length, 3)
})
