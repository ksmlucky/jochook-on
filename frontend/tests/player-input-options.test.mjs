import test from 'node:test'
import assert from 'node:assert/strict'
import { availableShirtNumbers, availableShirtNumbersForRow, birthYearOptions, parseShirtNumber, validBirthYearInput, validShirtNumberInput } from '../src/features/players/inputOptions.ts'

test('birth-year dropdown spans 1950 through the reference year minus 17 without tightening manual validation', () => {
  const years = birthYearOptions(2026)
  assert.equal(years[0], 2009); assert.equal(years.at(-1), 1950); assert.equal(years.length, 60)
  assert.deepEqual(birthYearOptions(2027).slice(0, 2), [2010, 2009])
  for (const value of ['', '1900', '1949', '1950', '2009', '2010', '2026']) assert.equal(validBirthYearInput(value, 2026), true, value)
  for (const value of ['1899', '2027', '96', '2009.0', 'NaN', ' 1996']) assert.equal(validBirthYearInput(value, 2026), false, value)
})

test('available shirt numbers cover 1 to 99, exclude all occupied player types, and preserve the edited player number', () => {
  const roster = [{ id: 1, shirtNumber: 1 }, { id: 2, shirtNumber: 99 }, { id: 3, shirtNumber: 7 }, { id: 4, shirtNumber: null }]
  const snapshot = structuredClone(roster)
  const choices = availableShirtNumbers(roster)
  assert.equal(choices.length, 96); assert.deepEqual(choices.slice(0, 3), [2, 3, 4])
  assert.equal(choices.includes(1), false); assert.equal(choices.includes(7), false); assert.equal(choices.includes(99), false)
  assert.equal(availableShirtNumbers(roster, 2).includes(99), true)
  assert.equal(availableShirtNumbers(roster, 2).includes(1), false)
  assert.deepEqual(roster, snapshot)
  assert.deepEqual(availableShirtNumbers(Array.from({ length: 99 }, (_, i) => ({ id: i + 1, shirtNumber: i + 1 }))), [])
})

test('each bulk row preserves its choice and immediately releases numbers after another row changes or is removed', () => {
  const rows = [{ key: 'a', shirtNumber: '12' }, { key: 'b', shirtNumber: '13' }]
  assert.equal(availableShirtNumbersForRow([], rows, 'a').includes(12), true)
  assert.equal(availableShirtNumbersForRow([], rows, 'a').includes(13), false)
  assert.equal(availableShirtNumbersForRow([], [{ ...rows[0] }, { key: 'b', shirtNumber: '14' }], 'a').includes(13), true)
  assert.equal(availableShirtNumbersForRow([], rows.slice(0, 1), 'a').includes(13), true)
  const duplicated = [{ key: 'a', shirtNumber: '12' }, { key: 'b', shirtNumber: '012' }]
  assert.equal(availableShirtNumbersForRow([], duplicated, 'a').includes(12), false)
  assert.equal(availableShirtNumbersForRow([], duplicated, 'b').includes(12), false)
  assert.deepEqual(duplicated.map(row => row.shirtNumber), ['12', '012'], 'availability never clears or rewrites manual and Excel values')
})

test('manual shirt values remain optional while invalid values cannot occupy available options', () => {
  for (const value of ['', ' ', '1', '99', '007']) assert.equal(validShirtNumberInput(value), true, value)
  for (const value of ['0', '100', '1.5', '-1', '1e1', '이름']) assert.equal(validShirtNumberInput(value), false, value)
  assert.equal(parseShirtNumber('007'), 7); assert.equal(parseShirtNumber(''), null)
  assert.equal(availableShirtNumbers([], undefined, ['0', '100', '1e1', '']).length, 99)
})
