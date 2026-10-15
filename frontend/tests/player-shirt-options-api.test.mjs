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
const { fetchShirtNumberRoster } = await import('../src/features/players/shirtNumbers.ts')
const { configureTeamAccess, captureTeamScope } = await import('../src/features/auth/teamRequest.ts')
const { SessionExpiredError } = await import('../src/features/auth/api.ts')
hooks.deregister()
const user = teamId => ({ username: 'synthetic-coach', authType: 'ACCOUNT', role: 'COACH', serviceAdmin: false, team: { id: teamId }, teams: [] })
const player = (id, shirtNumber, playerType = 'MEMBER') => ({ id, shirtNumber, playerType, name: `가상 ${id}`, position: 'UN', birthYear: null, clubRole: null, joinedOn: null, version: 0, firstChoice: null, secondChoice: null, thirdChoice: null })
const page = (items, page = 0, totalPages = 1) => ({ items, page, totalPages, size: 100, totalElements: totalPages, availableAgeGroups: [] })
function setup(t, handler) {
  const previousWindow = globalThis.window; globalThis.window = new EventTarget(); configureTeamAccess(user(11))
  const fetchMock = t.mock.method(globalThis, 'fetch', handler)
  t.after(() => { configureTeamAccess(null); globalThis.window = previousWindow })
  return fetchMock
}

test('shirt options fetch every active member and guest page using one team scope with no directory filters', async t => {
  const fetchMock = setup(t, async path => {
    const query = new URL(path, 'http://localhost'), current = Number(query.searchParams.get('page'))
    const guest = query.pathname.endsWith('/guests')
    return Response.json(page([player(current + (guest ? 11 : 1), current + (guest ? 91 : 1), guest ? 'GUEST' : 'MEMBER')], current, 2))
  })
  assert.deepEqual(await fetchShirtNumberRoster(new AbortController().signal), [
    { id: 1, shirtNumber: 1 }, { id: 2, shirtNumber: 2 }, { id: 11, shirtNumber: 91 }, { id: 12, shirtNumber: 92 },
  ])
  assert.deepEqual(fetchMock.mock.calls.map(call => call.arguments[0]), [
    '/api/v1/players?page=0&size=100&sort=id&direction=asc', '/api/v1/players?page=1&size=100&sort=id&direction=asc',
    '/api/v1/players/guests?page=0&size=100', '/api/v1/players/guests?page=1&size=100',
  ])
  assert.ok(fetchMock.mock.calls.every(call => call.arguments[1].headers.get('X-Team-Id') === '11' && call.arguments[1].method === undefined))
})

test('a failed guest page rejects the whole lookup instead of claiming occupied guest numbers are free', async t => {
  setup(t, async path => path.includes('/guests') ? Response.json({}, { status: 500 }) : Response.json(page([player(1, 1)])))
  await assert.rejects(fetchShirtNumberRoster(new AbortController().signal))
  assert.equal(captureTeamScope().teamId, 11)
})

test('a late page from a previous team is rejected without continuing into another team', async t => {
  let complete
  const fetchMock = setup(t, () => new Promise(resolve => { complete = resolve }))
  const pending = fetchShirtNumberRoster(new AbortController().signal)
  configureTeamAccess(user(22)); complete(Response.json(page([player(1, 1)], 0, 2)))
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(fetchMock.mock.calls.length, 1)
  assert.equal(captureTeamScope().teamId, 22)
})

test('closing the form aborts the lookup and an expired guest request uses the existing session lock', async t => {
  const fetchMock = setup(t, (_path, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true })))
  const controller = new AbortController(), pending = fetchShirtNumberRoster(controller.signal)
  controller.abort(); await assert.rejects(pending, { name: 'AbortError' })
  fetchMock.mock.mockImplementation(async path => path.includes('/guests') ? Response.json({}, { status: 401 }) : Response.json(page([])))
  await assert.rejects(fetchShirtNumberRoster(new AbortController().signal), SessionExpiredError)
  assert.throws(captureTeamScope, SessionExpiredError)
})
