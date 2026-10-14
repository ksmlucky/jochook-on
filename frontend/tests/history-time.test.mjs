import test from 'node:test'
import assert from 'node:assert/strict'
import { formatHistoryTime } from '../src/features/matches/historyTime.ts'

test('audit time uses Korean calendar date and includes seconds across midnight', () => {
  assert.equal(formatHistoryTime('2026-10-14T14:59:59Z'), '2026-10-14 23:59:59')
  assert.equal(formatHistoryTime('2026-10-14T15:00:00Z'), '2026-10-15 00:00:00')
  assert.equal(formatHistoryTime('2026-12-31T15:00:01Z'), '2027-01-01 00:00:01')
})
