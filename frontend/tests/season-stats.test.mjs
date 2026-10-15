import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultStatsFilters, koreaYear, playerMatchesQuery, playerMatchTournamentLabel, selectStats, statsQuery, statsScopeLabel, statsSorts, statsYearOptions, withStatsKind, withStatsTournament, statsMonthRange, withStatsRange, concededSummary } from '../src/features/stats/stats.ts'

const player = (playerId, shirtNumber, goals, extra = {}) => ({ playerId, shirtNumber, goals, name: `가상 선수 ${playerId}`, assists: 0, appearances: 0, attendances: 0, creditedQuarters: 0, playerType: 'MEMBER', active: true, birthYear: null, firstChoice: null, ...extra })

test('all-time list and detail explicitly remove calendar limits while retaining other filters and restore a bounded period', () => {
  const original = Object.freeze({ year: 2026, month: 9, kind: 'ALL', recordScope: 'RECORDED', includeGuests: true, competitionScope: 'TOURNAMENT', tournamentId: 7 })
  const all = withStatsRange(original, { startMonth: null, endMonth: null })
  const query = new URLSearchParams(statsQuery(all))
  assert.deepEqual(Object.fromEntries(query), { allTime: 'true', kind: 'ALL', recordScope: 'RECORDED', includeGuests: 'true', competitionScope: 'TOURNAMENT', tournamentId: '7' })
  const detail = new URLSearchParams(playerMatchesQuery(all, 2))
  detail.delete('page'); assert.equal(detail.toString(), query.toString())
  assert.deepEqual(statsMonthRange(all), { startMonth: null, endMonth: null })
  assert.match(statsScopeLabel(all), /^전체 기간 ·/)
  assert.equal(withStatsKind(all, 'EXTERNAL').allTime, true)
  const restored = withStatsRange(all, { startMonth: '2026-01', endMonth: '2026-12' })
  assert.equal(new URLSearchParams(statsQuery(restored)).has('allTime'), false)
  assert.deepEqual(statsMonthRange(restored), { startMonth: '2026-01', endMonth: '2026-12' })
  assert.equal(original.month, 9)
  for (const extra of [{ month: 1 }, { startMonth: '2026-01' }, { endMonth: '2026-12' }]) assert.throws(() => statsQuery({ ...all, ...extra }), RangeError)
})

test('team conceded summary distinguishes recorded clean sheets from missing scores and excluded internal games', () => {
  const cleanSheet = concededSummary({ goalsAgainst: 0, scoredExternalMatchCount: 2, missingExternalScoreCount: 1, excludedInternalMatchCount: 3 })
  assert.equal(cleanSheet.value, 0)
  assert.match(cleanSheet.note, /2경기 스코어 합산/)
  assert.match(cleanSheet.note, /매칭\(외부 팀과의 경기\)만 집계/)
  assert.match(cleanSheet.note, /스코어 미입력 1경기 제외/)
  assert.match(cleanSheet.note, /자체전 3경기 제외/)
  assert.equal(concededSummary({ goalsAgainst: null, scoredExternalMatchCount: 0, missingExternalScoreCount: 2 }).value, '—')
  assert.equal(concededSummary({ goalsAgainst: null, scoredExternalMatchCount: 0, excludedInternalMatchCount: 1 }).value, '—')
  assert.equal(concededSummary({}).value, '—', 'older response must not imply a clean sheet')
  assert.equal(concededSummary({ goalsAgainst: 7, scoredExternalMatchCount: 2 }).value, 7)
})

test('multi-month and cross-year stats use the same inclusive range in totals and details without a single-year constraint', () => {
  const original = Object.freeze({ year: 2026, month: 10, kind: 'ALL', recordScope: 'COMPLETED', includeGuests: false, competitionScope: 'LEAGUE' })
  for (const range of [{ startMonth: '2026-03', endMonth: '2026-06' }, { startMonth: '2025-12', endMonth: '2026-02' }]) {
    const filters = withStatsRange(original, range)
    const query = new URLSearchParams(statsQuery(filters))
    assert.equal(query.has('year'), false)
    assert.equal(query.has('month'), false)
    assert.equal(query.get('startMonth'), range.startMonth)
    assert.equal(query.get('endMonth'), range.endMonth)
    assert.equal(query.get('competitionScope'), 'LEAGUE')
    const detail = new URLSearchParams(playerMatchesQuery(filters, 3))
    assert.equal(detail.get('page'), '3')
    detail.delete('page')
    assert.deepEqual([...detail], [...query])
    assert.deepEqual(statsMonthRange(filters), range)
    assert.deepEqual(statsMonthRange(withStatsKind(filters, 'INTERNAL')), range)
  }
  assert.equal(original.month, 10)
  assert.match(statsScopeLabel(withStatsRange(original, { startMonth: '2026-03', endMonth: '2026-06' })), /^2026년 3월 ~ 2026년 6월/)
  assert.deepEqual(statsMonthRange({ ...original, month: null }), { startMonth: '2026-01', endMonth: '2026-12' })
  assert.deepEqual(statsMonthRange(original), { startMonth: '2026-10', endMonth: '2026-10' })
})

test('incomplete, reversed and mixed range requests cannot replace valid stats queries', () => {
  const base = defaultStatsFilters()
  for (const range of [{ startMonth: '2026-06', endMonth: '2026-03' }, { startMonth: '2026-03', endMonth: null }, { startMonth: null, endMonth: '2026-06' }, { startMonth: '2026-13', endMonth: '2027-01' }]) {
    assert.throws(() => withStatsRange(base, range), RangeError)
    assert.throws(() => statsQuery({ ...base, ...range }), RangeError)
  }
  assert.throws(() => statsQuery({ ...base, month: 1, startMonth: '2026-03', endMonth: '2026-06' }), RangeError)
})
test('season defaults use Korea calendar year at UTC boundary', () => {
  assert.equal(koreaYear(new Date('2025-12-31T14:59:59Z')), 2025)
  assert.equal(koreaYear(new Date('2025-12-31T15:00:00Z')), 2026)
})
test('season defaults combine league, internal games and tournaments; both screens retain current, selected and server years', () => {
  const now = new Date('2025-12-31T15:00:00Z')
  assert.deepEqual(defaultStatsFilters(now), { year: 2026, kind: 'ALL', recordScope: 'COMPLETED', includeGuests: false, competitionScope: 'ALL' })
  const serverYears = Object.freeze([2024, 2022, 2024])
  assert.deepEqual(statsYearOptions(serverYears, 2023, now), [2026, 2024, 2023, 2022])
  assert.deepEqual(statsYearOptions([], 2023, now), [2026, 2023], 'selected year remains usable during loading or a missing-record result')
  assert.deepEqual(serverYears, [2024, 2022, 2024])
})
test('stats query keeps completion, guests and match kind independent', () => {
  const query = new URLSearchParams(statsQuery({ year: 2026, kind: 'INTERNAL', recordScope: 'RECORDED', includeGuests: true }))
  assert.deepEqual(Object.fromEntries(query), { year: '2026', kind: 'INTERNAL', recordScope: 'RECORDED', includeGuests: 'true' })
})

test('monthly season and player queries retain identical filters, clear the month without changing the year, and reject invalid months', () => {
  const filters = Object.freeze({ year: 2025, month: 2, kind: 'ALL', recordScope: 'RECORDED', includeGuests: true, competitionScope: 'LEAGUE' })
  const list = new URLSearchParams(statsQuery(filters)), detail = new URLSearchParams(playerMatchesQuery(filters, 2))
  assert.equal(list.get('month'), '2'); assert.equal(list.get('year'), '2025')
  detail.delete('page'); assert.equal(list.toString(), detail.toString())
  assert.match(statsScopeLabel(filters), /^2025년 2월/)
  assert.equal(new URLSearchParams(statsQuery({ ...filters, month: null })).has('month'), false)
  for (const month of [0, 13, -1, 1.5, NaN, Infinity]) assert.throws(() => statsQuery({ ...filters, month }), RangeError)
  for (const month of [1, 12]) assert.equal(new URLSearchParams(statsQuery({ ...filters, month })).get('month'), String(month))
  assert.equal(filters.month, 2)
})
test('ties sort by actual shirt number then identity; null number comes last without changing source', () => {
  const rows = [player(8, null, 2), player(9, 23, 2), player(2, 2, 2), player(1, 1, 0)]
  assert.deepEqual(selectStats(rows, 'goals').map(row => row.playerId), [2, 9, 8, 1])
  assert.deepEqual(rows.map(row => row.playerId), [8, 9, 2, 1])
})

test('attendance ordering counts attended matches even without playing instead of sorting by appearances', () => {
  const attendanceSort = Object.entries(statsSorts).find(([, label]) => label === '출석 (회)')?.[0]
  const rows = [player(1, 1, 0, { appearances: 3, attendances: 3 }), player(2, 2, 0, { appearances: 0, attendances: 5 })]
  assert.equal(attendanceSort, 'attendances')
  assert.deepEqual(selectStats(rows, attendanceSort).map(row => row.playerId), [2, 1])
  assert.equal(rows[1].appearances, 0)
})

test('shirt and Korean name ordering toggle direction, keep missing numbers last and retain stable ties', () => {
  const rows = Object.freeze([
    player(1, null, 0, { name: '가상 다' }), player(2, 2, 0, { name: '가상 가' }),
    player(3, 10, 0, { name: '가상 나' }), player(4, 3, 0, { name: '가상 가' }),
  ])
  const ids = (key, dir) => selectStats(rows, key, '', 'TOTAL', dir).map(p => p.playerId)
  assert.deepEqual(ids('shirtNumber', 'asc'), [2, 4, 3, 1])
  assert.deepEqual(ids('shirtNumber', 'desc'), [3, 4, 2, 1])
  assert.deepEqual(ids('name', 'asc'), [2, 4, 3, 1])
  assert.deepEqual(ids('name', 'desc'), [1, 3, 2, 4])
  assert.deepEqual(rows.map(p => p.playerId), [1, 2, 3, 4])
})

test('numeric column ordering toggles without reversing identity ties or mixing attendance with appearances', () => {
  for (const key of ['goals', 'assists', 'freeKickGoals', 'penaltyGoals', 'appearances', 'creditedQuarters', 'attendances']) {
    const rows = [player(3, 3, 0, { [key]: 2 }), player(2, 2, 0, { [key]: 0.5 }), player(1, 1, 0, { [key]: 2 })]
    assert.deepEqual(selectStats(rows, key, '', 'TOTAL', 'asc').map(p => p.playerId), [2, 1, 3])
    assert.deepEqual(selectStats(rows, key, '', 'TOTAL', 'desc').map(p => p.playerId), [1, 3, 2])
    assert.deepEqual(selectStats(rows, key, '#2', 'TOTAL', 'asc').map(p => p.playerId), [2])
  }
})
test('half quarter statistics retain their numeric ordering and search does not invent a number', () => {
  const rows = [player(1, 1, 0, { creditedQuarters: 3.5 }), player(2, null, 0, { creditedQuarters: 4 }), player(3, 11, 0, { creditedQuarters: 1 })]
  assert.deepEqual(selectStats(rows, 'creditedQuarters').map(row => row.playerId), [2, 1, 3])
  assert.deepEqual(selectStats(rows, 'shirtNumber', '#1').map(row => row.playerId), [1])
  assert.deepEqual(selectStats(rows, 'goals', 'null'), [])
  assert.equal(selectStats(rows, 'goals', '가상 선수').length, 3)
})
test('player match pagination preserves the selected season scope and uses zero-based pages without changing page size', () => {
  const filters = { year: 2025, kind: 'INTERNAL', recordScope: 'ALL', includeGuests: true }
  const snapshot = structuredClone(filters)
  const query = new URLSearchParams(playerMatchesQuery(filters, 2))
  assert.deepEqual(Object.fromEntries(query), { year: '2025', kind: 'INTERNAL', recordScope: 'ALL', includeGuests: 'true', page: '2' })
  assert.equal(new URLSearchParams(playerMatchesQuery(filters, 0)).get('page'), '0')
  assert.deepEqual(filters, snapshot)
  for (const page of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => playerMatchesQuery(filters, page), RangeError)
})
test('detail scope text distinguishes guest inclusion, match type and legacy records', () => {
  assert.equal(statsScopeLabel({ year: 2026, kind: 'ALL', recordScope: 'RECORDED', includeGuests: false }), '2026년 · 전체 경기 · 자체전 포함 · 완료 + 이전 기록 · 회원 · 리그 + 대회 합산')
  assert.equal(statsScopeLabel({ year: 2025, kind: 'INTERNAL', recordScope: 'ALL', includeGuests: true }), '2025년 · 자체전만 · 작성 중 포함 · 회원과 용병 · 리그')
})

test('tournament queries send only a selected id and preserve legacy and cleared filter requests', () => {
  const base = { year: 2026, kind: 'EXTERNAL', recordScope: 'COMPLETED', includeGuests: false }
  const selected = { ...base, tournamentId: 41, tournamentName: '가상 대회 & 컵' }
  assert.deepEqual(Object.fromEntries(new URLSearchParams(statsQuery(selected))), {
    year: '2026', kind: 'EXTERNAL', recordScope: 'COMPLETED', includeGuests: 'false', tournamentId: '41',
  })
  assert.equal(statsQuery({ ...base, tournamentId: null, tournamentName: '이전 선택' }), statsQuery(base))
  assert.equal(statsQuery({ ...base, tournamentName: '이름만 있는 이전 응답' }), statsQuery(base))
  assert.deepEqual(Object.fromEntries(new URLSearchParams(playerMatchesQuery(selected, 3))), {
    year: '2026', kind: 'EXTERNAL', recordScope: 'COMPLETED', includeGuests: 'false', tournamentId: '41', page: '3',
  })
  assert.equal(selected.tournamentName, '가상 대회 & 컵', 'query construction must retain the UI label')
})

test('choosing a tournament releases internal-only filtering without restricting subsequent league selection to external games', () => {
  const base = Object.freeze({ year: 2025, kind: 'INTERNAL', recordScope: 'ALL', includeGuests: true })
  const selected = withStatsTournament(base, 41, '가상 대회')
  assert.deepEqual(selected, { ...base, kind: 'ALL', tournamentId: 41, tournamentName: '가상 대회' })
  assert.deepEqual(withStatsKind(selected, 'EXTERNAL'), { ...selected, kind: 'EXTERNAL' })
  assert.deepEqual(withStatsKind(selected, 'ALL'), selected)
  assert.deepEqual(withStatsKind(selected, 'INTERNAL'), { ...base, tournamentId: null, tournamentName: null })
  assert.deepEqual(withStatsTournament(selected, null), { ...base, kind: 'ALL', tournamentId: null, tournamentName: null })
  assert.equal(base.kind, 'INTERNAL')
  assert.equal(selected.tournamentId, 41)
})

test('scope and match captions show tournament names and stages without exposing database identifiers', () => {
  const base = { year: 2026, kind: 'EXTERNAL', recordScope: 'COMPLETED', includeGuests: false }
  assert.equal(statsScopeLabel({ ...base, tournamentId: 41, tournamentName: '가상 대회' }), '2026년 · 외부 경기만 · 기록 완료 · 회원 · 대회: 가상 대회')
  assert.equal(statsScopeLabel({ ...base, tournamentId: 41 }), '2026년 · 외부 경기만 · 기록 완료 · 회원 · 대회: 선택한 대회')
  assert.equal(statsScopeLabel({ ...base, tournamentId: null, tournamentName: '이전 선택' }), statsScopeLabel(base))
  assert.equal(playerMatchTournamentLabel({ tournamentId: 41, tournamentName: '가상 대회', tournamentStage: 'SEMI_FINAL' }), '가상 대회 · 준결승')
  assert.equal(playerMatchTournamentLabel({ tournamentId: 41, tournamentName: '가상 대회', tournamentStage: null }), '가상 대회')
  assert.equal(playerMatchTournamentLabel({ tournamentId: 41, tournamentStage: 'GROUP' }), '대회 이름 미확인 · 예선')
  assert.equal(playerMatchTournamentLabel({}), null)
  assert.equal(playerMatchTournamentLabel({ tournamentId: null, tournamentName: '이전 선택', tournamentStage: 'FINAL' }), null)
})
