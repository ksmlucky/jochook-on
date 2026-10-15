import test from 'node:test'
import assert from 'node:assert/strict'
import { appendMonthRangeQuery, appendYearMonthQuery, monthRangeDraft, monthRangeFromDraft, monthRangeLabel, monthRangeYearOptions, validateMonthRange } from '../src/app/yearMonth.ts'

test('valid same-year and cross-year ranges preserve both inclusive month boundaries in the query', () => {
  for (const range of [{ startMonth: '2026-03', endMonth: '2026-06' }, { startMonth: '2025-12', endMonth: '2026-02' }, { startMonth: '2026-03', endMonth: '2026-03' }]) {
    const query = new URLSearchParams('page=2&competitionScope=LEAGUE')
    appendMonthRangeQuery(query, range)
    assert.equal(query.get('startMonth'), range.startMonth)
    assert.equal(query.get('endMonth'), range.endMonth)
    assert.equal(query.get('page'), '2')
    assert.equal(query.has('year'), false)
    assert.equal(query.has('month'), false)
  }
})

test('all-time null pair omits range parameters and labels compact single-month and cross-year ranges', () => {
  const query = new URLSearchParams('page=0&size=10')
  appendMonthRangeQuery(query, { startMonth: null, endMonth: null })
  assert.equal(query.toString(), 'page=0&size=10')
  assert.equal(monthRangeLabel({ startMonth: null, endMonth: null }), '전체 기간')
  assert.equal(monthRangeLabel({ startMonth: '2026-03', endMonth: '2026-03' }), '2026년 3월')
  assert.equal(monthRangeLabel({ startMonth: '2026-03', endMonth: '2026-06' }), '2026년 3월 ~ 2026년 6월')
  assert.equal(monthRangeLabel({ startMonth: '2025-12', endMonth: '2026-02' }), '2025년 12월 ~ 2026년 2월')
})

test('missing, reversed or malformed boundaries fail without changing the previous query', () => {
  for (const range of [{ startMonth: '2026-03', endMonth: null }, { startMonth: null, endMonth: '2026-06' },
    { startMonth: '2026-06', endMonth: '2026-03' }, { startMonth: '', endMonth: '' },
    ...['2026-3', '2026-00', '2026-13', '999-03', '0999-03', '10000-03', '2026-03-01', ' 2026-03', '2026-03 '].map(value => ({ startMonth: value, endMonth: '2026-06' }))]) {
    const query = new URLSearchParams('page=0')
    assert.throws(() => appendMonthRangeQuery(query, range), RangeError)
    assert.equal(query.toString(), 'page=0')
  }
  assert.doesNotThrow(() => validateMonthRange({ startMonth: '1000-01', endMonth: '9999-12' }))
})

test('legacy year and month remain supported but cannot be mixed with active range boundaries', () => {
  const range = { startMonth: '2026-03', endMonth: '2026-06' }
  for (const legacy of [{ year: 2026 }, { month: 3 }, { year: 2026, month: 3 }]) {
    const query = new URLSearchParams('page=0')
    assert.throws(() => appendYearMonthQuery(query, { ...range, ...legacy }), RangeError)
    assert.equal(query.toString(), 'page=0')
  }
  const rangeQuery = new URLSearchParams(); appendYearMonthQuery(rangeQuery, range)
  assert.equal(rangeQuery.toString(), 'startMonth=2026-03&endMonth=2026-06')
  const oldQuery = new URLSearchParams(); appendYearMonthQuery(oldQuery, { year: 2026, month: 3 })
  assert.equal(oldQuery.toString(), 'year=2026&month=3')
})

test('partial range edits cannot replace an applied range before the four fields are valid', () => {
  const applied = Object.freeze({ startMonth: '2026-03', endMonth: '2026-06' })
  const originalDraft = Object.freeze(monthRangeDraft(applied))
  assert.deepEqual(originalDraft, { startYear: '2026', startMonthNumber: '3', endYear: '2026', endMonthNumber: '6' })
  assert.throws(() => monthRangeFromDraft({ ...originalDraft, endYear: '' }), /모두 선택/)
  assert.throws(() => monthRangeFromDraft({ ...originalDraft, endMonthNumber: '2' }), /빠를 수/)
  const next = monthRangeFromDraft({ ...originalDraft, endYear: '2027', endMonthNumber: '1' })
  assert.deepEqual(next, { startMonth: '2026-03', endMonth: '2027-01' })
  assert.deepEqual(applied, { startMonth: '2026-03', endMonth: '2026-06' })
  assert.deepEqual(monthRangeFromDraft(originalDraft), applied)
})

test('reset drafts support both list all-time and stats current-year January to December defaults', () => {
  assert.deepEqual(monthRangeDraft({ startMonth: null, endMonth: null }), { startYear: '', startMonthNumber: '', endYear: '', endMonthNumber: '' })
  assert.throws(() => monthRangeFromDraft(monthRangeDraft({ startMonth: null, endMonth: null })), /모두 선택/)
  const currentSeason = { startMonth: '2026-01', endMonth: '2026-12' }
  assert.deepEqual(monthRangeFromDraft(monthRangeDraft(currentSeason)), currentSeason)
})

test('range year choices include intervening years even if no records were returned for them', () => {
  const now = new Date('2026-01-01T00:00:00Z')
  assert.deepEqual(monthRangeYearOptions([2022, 2025], [], now), [2026, 2025, 2024, 2023, 2022])
  assert.deepEqual(monthRangeYearOptions([2024], ['2023', '2028'], now), [2028, 2027, 2026, 2025, 2024, 2023])
  assert.deepEqual(monthRangeYearOptions([], ['', 'bad'], now), [2026])
})
