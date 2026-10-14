import test from 'node:test'
import assert from 'node:assert/strict'
import { matchHistoryChanges } from '../src/features/matches/historyChanges.ts'
const base = () => ({ id: 1, version: 0, playedOn: '2026-10-18', kickoff: '07:00:00', kind: 'INTERNAL', venue: '검증 구장', opponent: '', notes: '', scoreFor: 1, scoreAgainst: 0,
  participants: [{ playerId: 9, name: '검증 선수', shirtNumber: 7, playerType: 'MEMBER', vote: 'ATTENDING', attendance: 'PRESENT' }],
  plannedLineup: [{ quarterNumber: 1, team: 'A', slot: 'ST', entryOrder: 0, playerId: 9 }],
  quarters: [{ number: 1, lineup: [{ team: 'A', slot: 'ST', entryOrder: 0, playerId: 9, goals: 1, assists: 0 }] }] })
test('history shows changed stats and attendance with shirt number, preserving A/B and substitute identity', () => {
  const before = base(), after = structuredClone(before)
  after.participants[0].attendance = 'LATE'
  after.quarters[0].lineup[0].goals = 2
  after.plannedLineup[0].team = 'B'
  after.plannedLineup[0].entryOrder = 1
  const changes = matchHistoryChanges(before, after)
  assert.equal(changes.length, 4)
  assert.ok(changes.some(c => c.label === '투표·출석 · #7 검증 선수' && c.after.endsWith('지각')))
  assert.ok(changes.some(c => c.label === '실제 출전 · 1쿼터 A팀 ST 선발' && c.before.includes('1골') && c.after.includes('2골')))
  assert.ok(changes.some(c => c.label === '계획 · 1쿼터 B팀 ST 교체' && c.before === '—' && c.after.includes('#7')))
})
test('deleted history retains the full recorded snapshot and created history has no invented previous values', () => {
  const deleted = matchHistoryChanges(base(), null), created = matchHistoryChanges(null, base())
  assert.ok(deleted.length >= 8)
  assert.ok(deleted.every(c => c.after === '—'))
  assert.ok(created.every(c => c.before === '—'))
  assert.ok(deleted.some(c => c.label === '스코어' && c.before === 'A팀 : B팀 · 1 : 0'))
})
test('version-only saves and subsequent profile name changes do not fabricate match edits', () => {
  const before = base(), after = structuredClone(before)
  after.version++
  after.participants[0].name = '이름 수정'
  assert.deepEqual(matchHistoryChanges(before, after), [])
})
