import test from 'node:test'
import assert from 'node:assert/strict'
import { displayScoringValue, scoringMetrics, scoringValue } from '../src/features/stats/scoringMetrics.ts'
import { playerMatchesQuery, selectStats, statsQuery, statsScopeLabel } from '../src/features/stats/stats.ts'

const player = (playerId, patch = {}) => ({ playerId, name: `가상 ${playerId}`, shirtNumber: playerId, goals: 0, assists: 0,
  freeKickGoals: 0, penaltyGoals: 0, creditedQuarters: 0, appearances: 0, attendances: 0, playerType: 'MEMBER', active: true, ...patch })

test('FK and PK remain subsets of total goals in cumulative and quarter-based views', () => {
  const row = Object.freeze(player(1, { goals: 5, assists: 2, freeKickGoals: 2, penaltyGoals: 1, creditedQuarters: 4, appearances: 7 }))
  assert.equal(scoringValue(row, 'goals'), 5)
  assert.equal(scoringValue(row, 'freeKickGoals'), 2)
  assert.equal(scoringValue(row, 'penaltyGoals'), 1)
  assert.equal(scoringValue(row, 'goals', 'PER_QUARTER'), 1.25)
  assert.equal(scoringValue(row, 'goals', 'PER_FOUR_QUARTERS'), 5)
  assert.equal(row.goals, 5, 'goal subsets cannot be added into or overwrite the stored total')
})

test('half quarters are the denominator and appearances cannot change the rate', () => {
  const row = player(1, { goals: 1, assists: 2, freeKickGoals: 1, creditedQuarters: 0.5, appearances: 3 })
  assert.deepEqual(scoringMetrics.map(metric => scoringValue(row, metric, 'PER_QUARTER')), [2, 4, 2, 0])
  assert.deepEqual(scoringMetrics.map(metric => scoringValue(row, metric, 'PER_TWO_QUARTERS')), [4, 8, 4, 0])
  assert.deepEqual(scoringMetrics.map(metric => scoringValue(row, metric, 'PER_THREE_QUARTERS')), [6, 12, 6, 0])
  assert.deepEqual(scoringMetrics.map(metric => scoringValue(row, metric, 'PER_FOUR_QUARTERS')), [8, 16, 8, 0])
  assert.equal(scoringValue({ ...row, appearances: 90 }, 'goals', 'PER_FOUR_QUARTERS'), 8)
})

test('zero-quarter records show a dash for every rate while cumulative values remain available', () => {
  const row = player(1, { goals: 2, assists: 1, freeKickGoals: 1 })
  for (const mode of ['PER_QUARTER', 'PER_TWO_QUARTERS', 'PER_THREE_QUARTERS', 'PER_FOUR_QUARTERS']) for (const metric of scoringMetrics) {
    assert.equal(scoringValue(row, metric, mode), null)
    assert.equal(displayScoringValue(row, metric, mode), '—')
  }
  assert.equal(displayScoringValue(row, 'goals'), '2')
  assert.equal(displayScoringValue(player(2, { creditedQuarters: 0.5 }), 'goals', 'PER_QUARTER'), '0.00')
})

test('missing legacy FK and PK use zero without changing the old total or denominator', () => {
  const old = { goals: 3, assists: 1, creditedQuarters: 3.5 }
  assert.equal(displayScoringValue(old, 'freeKickGoals'), '0')
  assert.equal(displayScoringValue(old, 'penaltyGoals', 'PER_FOUR_QUARTERS'), '0.00')
  assert.equal(displayScoringValue(old, 'goals', 'PER_FOUR_QUARTERS'), '3.43')
  assert.equal('freeKickGoals' in old, false)
})

test('rates round only for display and sort using full precision with unknown rates last', () => {
  const rows = [player(1, { goals: 1, creditedQuarters: 3.5 }), player(2, { goals: 100, creditedQuarters: 349 }),
    player(3, { goals: 1000, creditedQuarters: 0 }), player(4, { goals: 0, creditedQuarters: 4 })]
  assert.equal(displayScoringValue(rows[0], 'goals', 'PER_QUARTER'), '0.29')
  assert.equal(displayScoringValue(rows[1], 'goals', 'PER_QUARTER'), '0.29')
  assert.deepEqual(selectStats(rows, 'goals', '', 'PER_QUARTER').map(row => row.playerId), [2, 1, 4, 3])
  assert.deepEqual(selectStats(rows, 'goals', '', 'PER_QUARTER', 'asc').map(row => row.playerId), [4, 1, 2, 3])
  assert.deepEqual(selectStats(rows, 'goals', '', 'PER_FOUR_QUARTERS', 'asc').map(row => row.playerId), [4, 1, 2, 3])
  assert.deepEqual(selectStats(rows, 'goals').map(row => row.playerId), [3, 2, 1, 4])
  assert.deepEqual(rows.map(row => row.playerId), [1, 2, 3, 4])
})

test('assist, FK and PK sorts follow the selected rate while attendance and playing totals stay cumulative', () => {
  const rows = [player(1, { assists: 3, freeKickGoals: 3, penaltyGoals: 3, creditedQuarters: 12, attendances: 3 }),
    player(2, { assists: 1, freeKickGoals: 1, penaltyGoals: 1, creditedQuarters: 0.5, attendances: 1 })]
  for (const sort of ['assists', 'freeKickGoals', 'penaltyGoals']) {
    assert.deepEqual(selectStats(rows, sort).map(row => row.playerId), [1, 2])
    assert.deepEqual(selectStats(rows, sort, '', 'PER_FOUR_QUARTERS').map(row => row.playerId), [2, 1])
  }
  assert.deepEqual(selectStats(rows, 'attendances', '', 'PER_QUARTER').map(row => row.playerId), [1, 2])
  assert.deepEqual(selectStats(rows, 'creditedQuarters', '', 'PER_QUARTER').map(row => row.playerId), [1, 2])
  assert.deepEqual(selectStats(rows, 'freeKickGoals', '#1', 'PER_FOUR_QUARTERS').map(row => row.playerId), [1])
})

test('display mode changes neither season filters nor player-detail page query and round-trips without changing counts', () => {
  const filters = Object.freeze({ year: 2025, kind: 'EXTERNAL', recordScope: 'ALL', includeGuests: true,
    competitionScope: 'TOURNAMENT', tournamentId: 42, tournamentName: '가상 K7' })
  const counts = Object.freeze(player(7, { goals: 3, assists: 1, freeKickGoals: 1, penaltyGoals: 1, creditedQuarters: 3.5 }))
  const list = statsQuery(filters), detail = playerMatchesQuery(filters, 2), caption = statsScopeLabel(filters)
  for (const [displayMode, factor] of [['TOTAL', null], ['PER_QUARTER', 1], ['PER_TWO_QUARTERS', 2], ['PER_THREE_QUARTERS', 3], ['PER_FOUR_QUARTERS', 4], ['TOTAL', null]]) {
    assert.equal(statsQuery({ ...filters, displayMode }), list)
    assert.equal(playerMatchesQuery({ ...filters, displayMode }, 2), detail)
    assert.equal(statsScopeLabel({ ...filters, displayMode }), caption)
    assert.equal(scoringValue(counts, 'goals', displayMode), factor === null ? 3 : 3 / 3.5 * factor)
  }
})
