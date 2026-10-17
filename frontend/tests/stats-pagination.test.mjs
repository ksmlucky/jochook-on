import test from 'node:test'
import assert from 'node:assert/strict'
import { statsPage } from '../src/features/stats/pagination.ts'
import { selectStats } from '../src/features/stats/stats.ts'

const players = Array.from({ length: 47 }, (_, index) => Object.freeze({
  playerId: index + 1, name: `가상선수 ${index + 1}`, shirtNumber: index + 1,
  goals: index, assists: 0, creditedQuarters: 4, appearances: 1, attendances: 1,
  playerType: 'MEMBER', active: true,
}))

test('pagination follows global sorting, with no missing or repeated players and unchanged totals', () => {
  const sorted = selectStats(players, 'goals', '', 'TOTAL', 'desc')
  const pages = [0, 1, 2].map(page => statsPage(sorted, page, 20))
  assert.deepEqual(pages.map(page => page.items.length), [20, 20, 7])
  assert.equal(pages[0].items[0].playerId, 47)
  assert.deepEqual(pages.flatMap(page => page.items), sorted)
  assert.equal(players.reduce((sum, row) => sum + row.goals, 0), 1081)
})

test('shrinking search results clamps the page and empty results have a truthful range', () => {
  const found = selectStats(players, 'goals', '가상선수 47', 'TOTAL', 'desc')
  const page = statsPage(found, 2, 20)
  assert.equal(page.page, 0)
  assert.equal(page.from, 1)
  assert.equal(page.to, 1)
  assert.equal(page.items[0].playerId, 47)
  assert.deepEqual(statsPage([], 2, 20), { page: 0, totalPages: 1, items: [], from: 0, to: 0 })
})

test('10, 20, and 30 player pages include all rows through the final page', () => {
  for (const size of [10, 20, 30]) {
    const first = statsPage(players, 0, size)
    const last = statsPage(players, 999, size)
    assert.equal(first.items.length, size)
    assert.equal(last.to, 47)
    assert.equal(last.page, first.totalPages - 1)
    assert.equal(last.items.at(-1).playerId, 47)
  }
})
