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
const { fetchMatches } = await import('../src/features/matches/api.ts')
const { fetchSeasonStats, fetchPlayerSeasonMatches } = await import('../src/features/stats/api.ts')
const { configureTeamAccess, captureTeamScope } = await import('../src/features/auth/teamRequest.ts')
hooks.deregister()
const user = teamId => ({ username: null, authType: 'TEAM_CODE', role: 'MEMBER', serviceAdmin: false, team: { id: teamId }, teams: [] })
const filters = { year: 2026, kind: 'EXTERNAL', recordScope: 'COMPLETED', includeGuests: false }
function setup(t, handler) {
  const previousWindow = globalThis.window; globalThis.window = new EventTarget(); configureTeamAccess(user(11))
  const fetchMock = t.mock.method(globalThis, 'fetch', handler)
  t.after(() => { configureTeamAccess(null); globalThis.window = previousWindow })
  return fetchMock
}

test('match lists preserve the legacy all and single-tournament calls and add league/tournament queries', async t => {
  const fetchMock = setup(t, async () => Response.json({ items: [], page: 0, totalPages: 0, totalElements: 0 }))
  await fetchMatches(0)
  await fetchMatches(2, undefined, 42)
  await fetchMatches(0, undefined, null, 'LEAGUE')
  await fetchMatches(0, undefined, null, 'TOURNAMENT')
  await fetchMatches(0, undefined, 42, 'TOURNAMENT')
  assert.deepEqual(fetchMock.mock.calls.map(call => call.arguments[0]), [
    '/api/v1/matches?page=0&size=10', '/api/v1/matches?page=2&size=10&tournamentId=42',
    '/api/v1/matches?page=0&size=10&competitionScope=LEAGUE', '/api/v1/matches?page=0&size=10&competitionScope=TOURNAMENT',
    '/api/v1/matches?page=0&size=10&competitionScope=TOURNAMENT&tournamentId=42',
  ])
  assert.ok(fetchMock.mock.calls.every(call => call.arguments[1].headers.get('X-Team-Id') === '11' && call.arguments[1].method === undefined))
})

test('season total and player-detail APIs send the same league/tournament filters and never labels', async t => {
  const fetchMock = setup(t, async () => Response.json({ items: [] }))
  for (const selection of [{ competitionScope: 'LEAGUE' }, { competitionScope: 'TOURNAMENT' }, { competitionScope: 'TOURNAMENT', tournamentId: 42, tournamentName: '가상 K7' }]) {
    const selected = Object.freeze({ ...filters, ...selection })
    await fetchSeasonStats(selected, new AbortController().signal)
    await fetchPlayerSeasonMatches(7, selected, 3, new AbortController().signal)
    const calls = fetchMock.mock.calls.slice(-2), list = new URL(calls[0].arguments[0], 'http://localhost'), detail = new URL(calls[1].arguments[0], 'http://localhost')
    assert.equal(detail.searchParams.get('page'), '3'); detail.searchParams.delete('page')
    assert.equal(detail.searchParams.toString(), list.searchParams.toString())
    assert.equal(list.searchParams.get('competitionScope'), selection.competitionScope)
    assert.equal(list.searchParams.get('tournamentId'), selection.tournamentId == null ? null : '42')
    assert.equal(list.searchParams.has('tournamentName'), false)
  }
})

test('league requests retain all or internal-only type for the season and player detail rather than forcing external', async t => {
  const fetchMock = setup(t, async () => Response.json({ items: [] }))
  for (const kind of ['ALL', 'INTERNAL', 'EXTERNAL']) {
    const selected = { ...filters, kind, competitionScope: 'LEAGUE', year: 2025 }
    await fetchSeasonStats(selected, new AbortController().signal)
    await fetchPlayerSeasonMatches(7, selected, 0, new AbortController().signal)
    for (const call of fetchMock.mock.calls.slice(-2)) {
      const params = new URL(call.arguments[0], 'http://localhost').searchParams
      assert.equal(params.get('kind'), kind)
      assert.equal(params.get('competitionScope'), 'LEAGUE')
      assert.equal(params.get('year'), '2025')
      assert.equal(params.has('tournamentId'), false)
    }
  }
})

test('contradictory filters are rejected before network I/O', async t => {
  const fetchMock = setup(t, async () => Response.json({ items: [] }))
  await assert.rejects(fetchMatches(0, undefined, 42, 'LEAGUE'), RangeError)
  await assert.rejects(fetchSeasonStats({ ...filters, kind: 'INTERNAL', competitionScope: 'TOURNAMENT' }, new AbortController().signal), RangeError)
  await assert.rejects(fetchPlayerSeasonMatches(7, { ...filters, competitionScope: 'LEAGUE', tournamentId: 42 }, 0, new AbortController().signal), RangeError)
  assert.equal(fetchMock.mock.calls.length, 0)
})

test('changing team while the filtered match request is pending discards its response', async t => {
  let complete
  const fetchMock = setup(t, () => new Promise(resolve => { complete = resolve }))
  const pending = fetchMatches(0, new AbortController().signal, null, 'LEAGUE')
  configureTeamAccess(user(22)); complete(Response.json({ items: [{ id: 1 }] }))
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(captureTeamScope().teamId, 22)
  assert.equal(fetchMock.mock.calls.length, 1)
})
