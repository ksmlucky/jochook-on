import test from 'node:test'
import assert from 'node:assert/strict'
import { kickoffHours, kickoffMinutes, validKickoff, matchTimeRange } from '../src/features/matches/time.ts'

test('half-hour choices cover the full day without accepting missing or precise times', () => {
  const kickoffOptions = kickoffHours.flatMap(hour => kickoffMinutes.map(minute => `${hour}:${minute}`))
  assert.equal(kickoffOptions.length, 48)
  assert.equal(new Set(kickoffOptions).size, 48)
  assert.equal(kickoffOptions[0], '00:00')
  assert.equal(kickoffOptions.at(-1), '23:30')
  assert.ok(kickoffOptions.every(validKickoff))
  assert.equal(validKickoff('11:30:00'), true)
  for (const invalid of [null, '', '11:15', '11:30:01', '11:00:00.1', '24:00']) assert.equal(validKickoff(invalid), false)
})
test('display adds two hours and explicitly marks the following day', () => {
  assert.equal(matchTimeRange('11:00:00'), '11:00–13:00')
  assert.equal(matchTimeRange('11:30'), '11:30–13:30')
  assert.equal(matchTimeRange('22:00'), '22:00–다음 날 00:00')
  assert.equal(matchTimeRange('23:30:00'), '23:30–다음 날 01:30')
  assert.equal(matchTimeRange(null), '시간 미입력')
  assert.equal(matchTimeRange('11:15:00'), '11:15–13:15')
})
