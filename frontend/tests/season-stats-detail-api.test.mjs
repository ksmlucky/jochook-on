import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { readFileSync } from 'node:fs'

const authRoot = new URL('../src/features/auth/', import.meta.url).href
const statsRoot = new URL('../src/features/stats/', import.meta.url).href
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((context.parentURL?.startsWith(authRoot) && ['./api', './teamScope'].includes(specifier))
      || (context.parentURL?.startsWith(statsRoot) && ['./stats', '../auth/teamRequest'].includes(specifier))) {
      return nextResolve(`${specifier}.ts`, context)
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if ([`${authRoot}api.ts`, `${statsRoot}api.ts`].includes(url)) return {
      format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }), shortCircuit: true,
    }
    return nextLoad(url, context)
  },
})
const { fetchPlayerSeasonMatches, fetchSeasonStats, StatsRequestError } = await import('../src/features/stats/api.ts')
const { SessionExpiredError } = await import('../src/features/auth/api.ts')
const { configureTeamAccess, captureTeamScope } = await import('../src/features/auth/teamRequest.ts')
hooks.deregister()
const filters = { year: 2026, kind: 'EXTERNAL', recordScope: 'COMPLETED', includeGuests: false }
const user = teamId => ({ username: null, authType: 'TEAM_CODE', role: 'MEMBER', serviceAdmin: false, team: { id: teamId }, teams: [] })
function setup(t, handler) {
  const previousWindow = globalThis.window
  globalThis.window = new EventTarget()
  configureTeamAccess(user(11))
  const fetchMock = t.mock.method(globalThis, 'fetch', handler)
  t.after(() => { configureTeamAccess(null); globalThis.window = previousWindow })
  return fetchMock
}

test('all-time requests keep team context on list and detail without accidentally falling back to this year', async t => {
  const all = { ...filters, allTime: true }
  const fetchMock = setup(t, async () => Response.json({ ...all, items: [] }))
  await fetchSeasonStats(all, new AbortController().signal)
  await fetchPlayerSeasonMatches(7, all, 0, new AbortController().signal)
  for (const call of fetchMock.mock.calls) {
    const [url, init] = call.arguments
    const query = new URL(url, 'http://local.test').searchParams
    assert.equal(query.get('allTime'), 'true')
    for (const key of ['year', 'month', 'startMonth', 'endMonth']) assert.equal(query.has(key), false)
    assert.equal(new Headers(init.headers).get('X-Team-Id'), '11')
  }
})

test('range requests keep team context and identical period boundaries for list and detail', async t => {
  const range = { ...filters, startMonth: '2025-12', endMonth: '2026-06' }
  const fetchMock = setup(t, async () => Response.json({ ...range, items: [] }))
  await fetchSeasonStats(range, new AbortController().signal)
  await fetchPlayerSeasonMatches(7, range, 2, new AbortController().signal)
  for (const call of fetchMock.mock.calls) {
    const [url, init] = call.arguments
    const params = new URL(url, 'http://local.test').searchParams
    assert.equal(params.get('startMonth'), '2025-12')
    assert.equal(params.get('endMonth'), '2026-06')
    assert.equal(params.has('year'), false)
    assert.equal(params.has('month'), false)
    assert.equal(new Headers(init.headers).get('X-Team-Id'), '11')
  }
  await assert.rejects(fetchSeasonStats({ ...range, endMonth: '2025-11' }, new AbortController().signal), RangeError)
  assert.equal(fetchMock.mock.calls.length, 2)
})
test('member detail fetch is read-only, team-scoped, and keeps the exact filters and page', async t => {
  const response = { ...filters, player: { playerId: 7 }, page: 1, size: 10, totalElements: 11, totalPages: 2, items: [] }
  const fetchMock = setup(t, async () => Response.json(response))
  assert.deepEqual(await fetchPlayerSeasonMatches(7, filters, 1, new AbortController().signal), response)
  const [path, options] = fetchMock.mock.calls[0].arguments
  assert.equal(path, '/api/v1/stats/players/7/matches?year=2026&kind=EXTERNAL&recordScope=COMPLETED&includeGuests=false&page=1')
  assert.equal(options.headers.get('X-Team-Id'), '11')
  assert.equal(options.method, undefined)
  assert.equal(options.cache, 'no-store')
  assert.equal(fetchMock.mock.calls.length, 1, 'read request must not obtain CSRF or write')
})

test('tournament detail request preserves its filter and returns match tournament labels', async t => {
  const selected = Object.freeze({ ...filters, tournamentId: 41, tournamentName: '가상 대회' })
  const response = { ...selected, player: { playerId: 7 }, page: 2, size: 10, totalElements: 21, totalPages: 3,
    items: [{ matchId: 3, tournamentId: 41, tournamentName: '가상 대회', tournamentStage: 'FINAL' }] }
  const fetchMock = setup(t, async () => Response.json(response))
  assert.deepEqual(await fetchPlayerSeasonMatches(7, selected, 2, new AbortController().signal), response)
  const [path, options] = fetchMock.mock.calls[0].arguments
  assert.equal(path, '/api/v1/stats/players/7/matches?year=2026&kind=EXTERNAL&recordScope=COMPLETED&includeGuests=false&tournamentId=41&page=2')
  assert.equal(options.headers.get('X-Team-Id'), '11')
  assert.equal(options.method, undefined)
  assert.equal(selected.tournamentName, '가상 대회')
})
test('detail 404 stays a retryable missing-record error without expiring the team session', async t => {
  setup(t, async () => Response.json({}, { status: 404 }))
  await assert.rejects(fetchPlayerSeasonMatches(7, filters, 0, new AbortController().signal), cause => cause instanceof StatsRequestError && cause.status === 404)
  assert.equal(captureTeamScope().teamId, 11)
})

test('a missing record in a changed year can be followed by a new league query for the same player without rejoining the team', async t => {
  const fetchMock = setup(t, async path => new URL(path, 'http://localhost').searchParams.get('year') === '2025'
    ? Response.json({}, { status: 404 })
    : Response.json({ player: { playerId: 7 }, page: 0, items: [{ matchId: 9, kind: 'INTERNAL', goals: 2 }] }))
  const oldYear = { ...filters, year: 2025, kind: 'ALL', competitionScope: 'LEAGUE' }
  await assert.rejects(fetchPlayerSeasonMatches(7, oldYear, 0, new AbortController().signal), cause => cause instanceof StatsRequestError && cause.status === 404)
  const result = await fetchPlayerSeasonMatches(7, { ...oldYear, year: 2026 }, 0, new AbortController().signal)
  assert.equal(result.items[0].kind, 'INTERNAL')
  assert.equal(result.items[0].goals, 2)
  assert.equal(captureTeamScope().teamId, 11)
  assert.equal(fetchMock.mock.calls.length, 2)
  assert.ok(fetchMock.mock.calls.every(call => new URL(call.arguments[0], 'http://localhost').searchParams.get('page') === '0'))
})

test('season and detail APIs preserve total goals and the independent FK/PK breakdown', async t => {
  const item = { playerId: 7, goals: 5, assists: 2, freeKickGoals: 2, penaltyGoals: 1, creditedQuarters: 3.5 }
  const match = { matchId: 1, goals: 3, assists: 1, freeKickGoals: 1, penaltyGoals: 1, creditedQuarters: 0.5 }
  setup(t, async path => Response.json(path.includes('/7/matches?') ? { ...filters, player: item, items: [match], page: 0, size: 10, totalElements: 1, totalPages: 1 } : { ...filters, items: [item] }))
  const season = await fetchSeasonStats(filters, new AbortController().signal)
  const detail = await fetchPlayerSeasonMatches(7, filters, 0, new AbortController().signal)
  assert.deepEqual(season.items[0], item); assert.deepEqual(detail.player, item); assert.deepEqual(detail.items[0], match)
  assert.equal(season.items[0].goals, 5)
})

test('monthly season and detail requests preserve team authorization and the same period', async t => {
  const fetchMock = setup(t, async () => Response.json({ items: [] }))
  const selected = { ...filters, year: 2025, month: 12, tournamentId: 41 }
  await fetchSeasonStats(selected, new AbortController().signal)
  await fetchPlayerSeasonMatches(7, selected, 0, new AbortController().signal)
  for (const call of fetchMock.mock.calls) {
    const query = new URL(call.arguments[0], 'http://localhost').searchParams
    assert.equal(query.get('year'), '2025'); assert.equal(query.get('month'), '12'); assert.equal(query.get('tournamentId'), '41')
    assert.equal(call.arguments[1].headers.get('X-Team-Id'), '11')
  }
  await assert.rejects(fetchPlayerSeasonMatches(7, { ...selected, month: 13 }, 0, new AbortController().signal), RangeError)
  assert.equal(fetchMock.mock.calls.length, 2)
})
test('detail session expiry uses the shared team lock', async t => {
  setup(t, async () => Response.json({}, { status: 401 }))
  await assert.rejects(fetchPlayerSeasonMatches(7, filters, 0, new AbortController().signal), SessionExpiredError)
  assert.throws(captureTeamScope, SessionExpiredError)
})
test('a detail response from the previous team is rejected even if the server responds late', async t => {
  let complete
  setup(t, () => new Promise(resolve => { complete = resolve }))
  const pending = fetchPlayerSeasonMatches(7, filters, 0, new AbortController().signal)
  configureTeamAccess(user(22))
  complete(Response.json({ items: [{ name: '가상 이전 선수' }] }))
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(captureTeamScope().teamId, 22)
})
test('closing the detail aborts its request and invalid pagination never sends a request', async t => {
  const fetchMock = setup(t, (_path, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true })
  }))
  const controller = new AbortController()
  const pending = fetchPlayerSeasonMatches(7, filters, 0, controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  await assert.rejects(fetchPlayerSeasonMatches(7, filters, -1, new AbortController().signal), RangeError)
  await assert.rejects(fetchPlayerSeasonMatches(0, filters, 0, new AbortController().signal), /선수/)
  assert.equal(fetchMock.mock.calls.length, 1)
})
