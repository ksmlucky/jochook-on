import test from 'node:test'
import assert from 'node:assert/strict'
import { appendYearMonthQuery, changePeriodYear, currentYear, yearOptions } from '../src/app/yearMonth.ts'

test('year options preserve the selected and current Korean year alongside every server year without mutating them', () => {
  const now = new Date('2025-12-31T15:00:00Z'), years = Object.freeze([2022, 2025, 2022, 2020])
  assert.equal(currentYear(new Date('2025-12-31T14:59:59Z')), 2025)
  assert.equal(currentYear(now), 2026)
  assert.deepEqual(yearOptions(years, 2023, now), [2026, 2025, 2023, 2022, 2020])
  assert.deepEqual(years, [2022, 2025, 2022, 2020])
})

test('unavailable year metadata retains usable current and selected years without inventing historical options', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  assert.deepEqual(yearOptions([], null, now), [2026])
  assert.deepEqual(yearOptions([], 2021, now), [2026, 2021])
  assert.deepEqual(yearOptions([999, 10000, 2020.5, NaN, 2020], null, now), [2026, 2020])
})

test('all years clears the month while changing a specific year retains the chosen month', () => {
  const initial = Object.freeze({ year: 2026, month: 10 })
  assert.deepEqual(changePeriodYear(initial, 2025), { year: 2025, month: 10 })
  const cleared = changePeriodYear(initial, null)
  assert.deepEqual(cleared, { year: null, month: null })
  assert.deepEqual(changePeriodYear(cleared, 2025), { year: 2025, month: null })
  assert.deepEqual(initial, { year: 2026, month: 10 })
})

test('period query omits all-time defaults and preserves competition and pagination filters', () => {
  for (const period of [{}, { year: null, month: null }]) {
    const query = new URLSearchParams('page=2&size=10&tournamentId=42')
    appendYearMonthQuery(query, period)
    assert.equal(query.toString(), 'page=2&size=10&tournamentId=42')
  }
  const yearOnly = new URLSearchParams('competitionScope=LEAGUE')
  appendYearMonthQuery(yearOnly, { year: 2026, month: null })
  assert.equal(yearOnly.toString(), 'competitionScope=LEAGUE&year=2026')
  appendYearMonthQuery(yearOnly, { year: 2025, month: 2 })
  assert.equal(yearOnly.toString(), 'competitionScope=LEAGUE&year=2025&month=2')
})

test('period validation rejects a month without a year and every out-of-range or fractional value', () => {
  for (const period of [{ month: 1 }, { year: null, month: 12 }, { year: 999 }, { year: 10000 }, { year: 2026.5 },
    { year: Infinity }, { year: NaN }, { year: 2026, month: 0 }, { year: 2026, month: 13 }, { year: 2026, month: 1.5 }, { year: 2026, month: NaN }]) {
    const query = new URLSearchParams('page=0')
    assert.throws(() => appendYearMonthQuery(query, period), RangeError)
    assert.equal(query.toString(), 'page=0')
  }
  for (const period of [{ year: 1000, month: 1 }, { year: 9999, month: 12 }]) assert.doesNotThrow(() => appendYearMonthQuery(new URLSearchParams(), period))
})
