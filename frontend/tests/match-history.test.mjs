import test from 'node:test'
import assert from 'node:assert/strict'
import { matchHistoryChanges } from '../src/features/matches/historyChanges.ts'
const base = () => ({ id: 1, version: 0, playedOn: '2026-10-18', kickoff: '07:00:00', kind: 'INTERNAL', venue: '검증 구장', opponent: '', notes: '', scoreFor: 1, scoreAgainst: 0,
  participants: [{ playerId: 9, name: '검증 선수', shirtNumber: 7, playerType: 'MEMBER', vote: 'ATTENDING', attendance: 'PRESENT' }],
  plannedLineup: [{ quarterNumber: 1, team: 'A', slot: 'ST', entryOrder: 0, playerId: 9 }],
  quarters: [{ number: 1, lineup: [{ team: 'A', slot: 'ST', entryOrder: 0, playerId: 9, goals: 1, assists: 0 }] }] })

test('preassigned team changes and explicit clearing are readable in history', () => {
  const before=base(), after=structuredClone(before)
  before.participants[0].plannedTeam='A'; after.participants[0].plannedTeam='B'
  const changes=matchHistoryChanges(before,after)
  assert.deepEqual(changes,[{label:'사전 팀 배정 · #7 검증 선수',before:'A팀',after:'B팀'}])
  after.participants[0].plannedTeam=null
  assert.equal(matchHistoryChanges(before,after)[0].after,'미배정')
  delete before.participants[0].plannedTeam
  assert.deepEqual(matchHistoryChanges(before,after),[])
})

test('changing only goal breakdown is visible while legacy missing and zero do not invent a history edit', () => {
  const before=base(), after=structuredClone(before)
  Object.assign(after.quarters[0].lineup[0],{freeKickGoals:0,penaltyGoals:0})
  assert.deepEqual(matchHistoryChanges(before,after),[])
  after.quarters[0].lineup[0].freeKickGoals=1
  const changes=matchHistoryChanges(before,after)
  assert.equal(changes.length,1)
  assert.match(changes[0].before,/일반 1 · 프리킥 0 · PK 0/)
  assert.match(changes[0].after,/일반 0 · 프리킥 1 · PK 0/)
  const penalty=structuredClone(after)
  Object.assign(penalty.quarters[0].lineup[0],{freeKickGoals:0,penaltyGoals:1})
  assert.match(matchHistoryChanges(after,penalty)[0].after,/일반 0 · 프리킥 0 · PK 1/)
})
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
test('history displays A/B formation changes and new paired positions without inventing a legacy migration change', () => {
  const before = base(), after = structuredClone(before)
  after.formationA = 'F4123'
  assert.deepEqual(matchHistoryChanges(before, after), [])
  after.formationB = 'F4231'
  after.plannedLineup.push({ quarterNumber: 1, team: 'B', slot: 'RCDM', entryOrder: 0, playerId: 9 })
  const changes = matchHistoryChanges(before, after)
  assert.ok(changes.some(change => change.label === '포메이션 · B팀' && change.before === '4-1-2-3' && change.after === '4-2-3-1'))
  assert.ok(changes.some(change => change.label === '계획 · 1쿼터 B팀 CDM 우 선발'))
})
test('three-back changes identify the central CB and wingback roles in history', () => {
  const before = base(), after = structuredClone(before)
  after.formationA = 'F352'
  after.plannedLineup = [{ quarterNumber: 1, team: 'A', slot: 'CCB', entryOrder: 0, playerId: 9 }]
  after.quarters[0].lineup[0].slot = 'LWB'
  const changes = matchHistoryChanges(before, after)
  assert.ok(changes.some(change => change.label === '포메이션 · A팀' && change.after === '3-5-2'))
  assert.ok(changes.some(change => change.label === '계획 · 1쿼터 A팀 CB 중앙 선발'))
  assert.ok(changes.some(change => change.label === '실제 출전 · 1쿼터 A팀 LWB 선발'))
})

test('tournament linkage and stage changes are recorded and can be cleared without changing match stats', () => {
  const before = { ...base(), kind: 'EXTERNAL' }, after = structuredClone(before)
  Object.assign(after, { tournamentId: 41, tournamentName: '가상 대회', tournamentStage: 'GROUP' })
  assert.deepEqual(matchHistoryChanges(before, after), [
    { label: '대회 연결', before: '—', after: '가상 대회' },
    { label: '대회 단계', before: '—', after: '예선' },
  ])
  assert.deepEqual(matchHistoryChanges(after, before), [
    { label: '대회 연결', before: '가상 대회', after: '—' },
    { label: '대회 단계', before: '예선', after: '—' },
  ])
  assert.deepEqual(matchHistoryChanges(after, { ...after, tournamentStage: 'FINAL' }), [
    { label: '대회 단계', before: '예선', after: '결승' },
  ])
})

test('linking a different tournament with the same name remains visible without leaking its primary key', () => {
  const before = { ...base(), kind: 'EXTERNAL', tournamentId: 41, tournamentName: '가상 대회', tournamentStage: 'GROUP' }
  const after = { ...before, tournamentId: 42 }
  assert.deepEqual(matchHistoryChanges(before, after), [
    { label: '대회 연결 · 다른 대회로 변경', before: '가상 대회', after: '가상 대회' },
  ])
  assert.deepEqual(matchHistoryChanges(before, { ...after, tournamentName: '다른 가상 대회' }), [
    { label: '대회 연결', before: '가상 대회', after: '다른 가상 대회' },
  ])
})

test('a tournament rename alone and legacy missing fields do not invent a match change', () => {
  const before = { ...base(), kind: 'EXTERNAL', tournamentId: 41, tournamentName: '가상 대회', tournamentStage: null }
  assert.deepEqual(matchHistoryChanges(before, { ...before, tournamentName: '수정된 대회 이름' }), [])
  assert.deepEqual(matchHistoryChanges(base(), { ...base(), tournamentId: null, tournamentName: null, tournamentStage: null }), [])
  const created = matchHistoryChanges(null, before), deleted = matchHistoryChanges(before, null)
  assert.ok(created.some(change => change.label === '대회 연결' && change.before === '—' && change.after === '가상 대회'))
  assert.ok(deleted.some(change => change.label === '대회 연결' && change.before === '가상 대회' && change.after === '—'))
})
