import test from 'node:test'
import assert from 'node:assert/strict'
import { outsideTournamentDates } from '../src/features/matches/tournamentFields.ts'
test('competition date guidance includes endpoints and accepts unspecified metadata',()=>{
  const dates={startDate:'2026-10-01',endDate:'2026-10-31'}
  assert.equal(outsideTournamentDates('2026-10-01',dates),false)
  assert.equal(outsideTournamentDates('2026-10-31',dates),false)
  assert.equal(outsideTournamentDates('2026-09-30',dates),true)
  assert.equal(outsideTournamentDates('2026-11-01',dates),true)
  assert.equal(outsideTournamentDates('',dates),false)
  assert.equal(outsideTournamentDates('2026-11-01',null),false)
})
