import test from 'node:test'
import assert from 'node:assert/strict'
import { hasPlayerFilters, playerQueryParams } from '../src/features/players/query.ts'

const query = { size: 20, sort: 'shirtNumber', direction: 'asc' }

test('compound player filters are sent with sorting and pagination for server filtering', () => {
  const filters = { ageGroup: '30', clubRole: '코치', positionGroup: 'MF' }
  const params = playerQueryParams(2, { ...query, ...filters })
  assert.deepEqual(Object.fromEntries(new URLSearchParams(params.toString())), {
    page: '2', size: '20', sort: 'shirtNumber', direction: 'asc', ...filters,
  })
  assert.equal(hasPlayerFilters(filters), true)
})

test('unfiltered pickers and cleared roster filters omit all filter parameters', () => {
  const expected = { page: '0', size: '20', sort: 'shirtNumber', direction: 'asc' }
  assert.deepEqual(Object.fromEntries(playerQueryParams(0, query)), expected)
  const cleared = { ageGroup: '', clubRole: '', positionGroup: '' }
  assert.deepEqual(Object.fromEntries(playerQueryParams(0, { ...query, ...cleared })), expected)
  assert.equal(hasPlayerFilters({}), false)
  assert.equal(hasPlayerFilters(cleared), false)
})

test('missing birth year can combine with a first preference position group', () => {
  const filters = { ageGroup: 'UNKNOWN', positionGroup: 'DF' }
  const params = playerQueryParams(0, { ...query, ...filters })
  assert.equal(params.get('ageGroup'), 'UNKNOWN')
  assert.equal(params.get('positionGroup'), 'DF')
  assert.equal(params.has('firstChoice'), false)
  assert.equal(params.has('clubRole'), false)
  assert.equal(hasPlayerFilters(filters), true)
})
