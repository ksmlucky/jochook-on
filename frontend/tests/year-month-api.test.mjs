import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'

const sourceRoot = new URL('../src/', import.meta.url).href
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(sourceRoot) && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && existsSync(new URL(`${specifier}.ts`, context.parentURL))) return nextResolve(`${specifier}.ts`, context)
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith(sourceRoot) && url.endsWith('.ts')) return { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }), shortCircuit: true }
    return nextLoad(url, context)
  },
})
const { fetchMatches, fetchMatchYears } = await import('../src/features/matches/api.ts')
const { fetchAllTournaments, fetchTournaments, fetchTournamentYears } = await import('../src/features/tournaments/api.ts')
const { configureTeamAccess, captureTeamScope } = await import('../src/features/auth/teamRequest.ts')
const { SessionExpiredError } = await import('../src/features/auth/api.ts')
hooks.deregister()
const user = teamId => ({ username: null, authType: 'TEAM_CODE', role: 'MEMBER', serviceAdmin: false, team: { id: teamId }, teams: [] })
function setup(t, handler) {
  const previousWindow = globalThis.window; globalThis.window = new EventTarget(); configureTeamAccess(user(11))
  const fetchMock = t.mock.method(globalThis, 'fetch', handler)
  t.after(() => { configureTeamAccess(null); globalThis.window = previousWindow })
  return fetchMock
}

test('match pagination combines period and competition filters while old calls remain all-time', async t => {
  const fetchMock = setup(t, async () => Response.json({ items: [], page: 0, totalPages: 0, totalElements: 0 }))
  await fetchMatches(0)
  await fetchMatches(2, undefined, null, 'LEAGUE', { year: 2026, month: 10 })
  await fetchMatches(1, undefined, 42, 'TOURNAMENT', { year: 2025, month: null })
  assert.deepEqual(fetchMock.mock.calls.map(call => call.arguments[0]), [
    '/api/v1/matches?page=0&size=10',
    '/api/v1/matches?page=2&size=10&competitionScope=LEAGUE&year=2026&month=10',
    '/api/v1/matches?page=1&size=10&competitionScope=TOURNAMENT&tournamentId=42&year=2025',
  ])
})

test('tournament period is sent to the server before pagination while registration pickers stay all-time', async t => {
  const fetchMock = setup(t, async () => Response.json({ items: [], page: 0, totalPages: 0, totalElements: 0 }))
  await fetchTournaments(2, undefined, 10, undefined, { year: 2026, month: 1 })
  await fetchTournaments(0, undefined, 10, undefined, { year: 2025 })
  await fetchAllTournaments(new AbortController().signal)
  assert.deepEqual(fetchMock.mock.calls.map(call => call.arguments[0]), [
    '/api/v1/tournaments?page=2&size=10&year=2026&month=1', '/api/v1/tournaments?page=0&size=10&year=2025', '/api/v1/tournaments?page=0&size=100',
  ])
})

test('invalid list periods fail before network IO without silently choosing a year', async t => {
  const fetchMock = setup(t, async () => Response.json({ items: [] }))
  await assert.rejects(fetchMatches(0, undefined, null, 'ALL', { month: 1 }), RangeError)
  await assert.rejects(fetchTournaments(0, undefined, 10, undefined, { month: 1 }), RangeError)
  await assert.rejects(fetchMatches(0, undefined, null, 'ALL', { year: 9999, month: 13 }), RangeError)
  await assert.rejects(fetchTournaments(0, undefined, 10, undefined, { year: 999 }), RangeError)
  assert.equal(fetchMock.mock.calls.length, 0)
})

test('match and tournament lists send range pairs alongside existing scope and pagination without legacy date keys', async t => {
  const fetchMock = setup(t, async () => Response.json({ items: [], page: 0, totalPages: 0 }))
  const range = Object.freeze({ startMonth: '2025-12', endMonth: '2026-03' })
  await fetchMatches(2, undefined, 42, 'TOURNAMENT', range)
  await fetchTournaments(1, undefined, 10, undefined, range)
  assert.deepEqual(fetchMock.mock.calls.map(call => call.arguments[0]), [
    '/api/v1/matches?page=2&size=10&competitionScope=TOURNAMENT&tournamentId=42&startMonth=2025-12&endMonth=2026-03',
    '/api/v1/tournaments?page=1&size=10&startMonth=2025-12&endMonth=2026-03',
  ])
  for (const call of fetchMock.mock.calls) {
    const params = new URL(call.arguments[0], 'http://localhost').searchParams
    assert.equal(params.has('year'), false); assert.equal(params.has('month'), false)
  }
})

test('invalid or mixed range requests fail before IO and clearing the range returns to the all-time query', async t => {
  const fetchMock = setup(t, async () => Response.json({ items: [] }))
  for (const period of [{ startMonth: '2026-03' }, { startMonth: '2026-06', endMonth: '2026-03' }, { year: 2026, startMonth: '2026-03', endMonth: '2026-06' }]) {
    await assert.rejects(fetchMatches(0, undefined, null, 'ALL', period), RangeError)
    await assert.rejects(fetchTournaments(0, undefined, 10, undefined, period), RangeError)
  }
  assert.equal(fetchMock.mock.calls.length, 0)
  await fetchMatches(0, undefined, null, 'ALL', { startMonth: null, endMonth: null })
  await fetchTournaments(0, undefined, 10, undefined, { startMonth: null, endMonth: null })
  assert.deepEqual(fetchMock.mock.calls.map(call => call.arguments[0]), ['/api/v1/matches?page=0&size=10', '/api/v1/tournaments?page=0&size=10'])
})

test('available-year endpoints use read-only team-scoped requests and preserve every returned year', async t => {
  const fetchMock = setup(t, async path => Response.json(path.startsWith('/api/v1/matches/') ? [2026, 2024] : [2026, 2025, 2024]))
  assert.deepEqual(await fetchMatchYears(new AbortController().signal), [2026, 2024])
  assert.deepEqual(await fetchTournamentYears(new AbortController().signal), [2026, 2025, 2024])
  assert.deepEqual(fetchMock.mock.calls.map(call => call.arguments[0]), ['/api/v1/matches/years', '/api/v1/tournaments/years'])
  assert.ok(fetchMock.mock.calls.every(call => call.arguments[1].headers.get('X-Team-Id') === '11' && call.arguments[1].method === undefined))
})

test('failed year metadata is an error rather than an empty data set and does not block the ordinary list', async t => {
  setup(t, async path => path.endsWith('/years') ? Response.json({}, { status: 503 }) : Response.json({ items: [{ id: 7 }], totalPages: 1 }))
  await assert.rejects(fetchMatchYears(new AbortController().signal))
  await assert.rejects(fetchTournamentYears(new AbortController().signal))
  assert.equal((await fetchMatches(0)).items[0].id, 7)
  assert.equal((await fetchTournaments(0)).items[0].id, 7)
  assert.equal(captureTeamScope().teamId, 11)
})

test('a previous team year response is discarded instead of replacing the current team options', async t => {
  let complete
  setup(t, () => new Promise(resolve => { complete = resolve }))
  const pending = fetchTournamentYears(new AbortController().signal)
  configureTeamAccess(user(22)); complete(Response.json([2025]))
  await assert.rejects(pending, { name: 'AbortError' })
})

test('closing a list can cancel its year-metadata request without invalidating team access', async t => {
  setup(t, (_path, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true })))
  const controller = new AbortController()
  const pending = fetchMatchYears(controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(captureTeamScope().teamId, 11)
})

test('year metadata session expiry locks the shared team access', async t => {
  setup(t, async () => Response.json({}, { status: 401 }))
  await assert.rejects(fetchMatchYears(new AbortController().signal), SessionExpiredError)
  assert.throws(captureTeamScope, SessionExpiredError)
})
