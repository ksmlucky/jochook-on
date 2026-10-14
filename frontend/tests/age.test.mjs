import test from 'node:test'
import assert from 'node:assert/strict'
import { ageBand, yearAge, seoulYear } from '../src/features/players/age.ts'

test('birth year uses the chosen calendar year, including decade boundaries', () => {
  assert.equal(yearAge(1996, 2026), 30)
  assert.equal(ageBand(1996, 2025), '20대')
  assert.equal(ageBand(1996, 2026), '30대')
  assert.equal(ageBand(1986, 2026), '40대')
})
test('missing or future birth years do not claim an age group', () => {
  assert.equal(yearAge(null, 2026), null)
  assert.equal(ageBand(null, 2026), '연령대 미확인')
  assert.equal(ageBand(1996, 1995), '연령대 미확인')
})
test('the current reference year changes at Korean New Year', () => {
  assert.equal(seoulYear(new Date('2026-12-31T14:59:59Z')), 2026)
  assert.equal(seoulYear(new Date('2026-12-31T15:00:00Z')), 2027)
})
