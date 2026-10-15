import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { readFileSync } from 'node:fs'

const authRoot = new URL('../src/features/auth/', import.meta.url).href
const featureRoot = new URL('../src/features/tournaments/', import.meta.url).href
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((context.parentURL?.startsWith(authRoot) && ['./api', './teamScope'].includes(specifier))
      || (context.parentURL?.startsWith(featureRoot) && specifier === '../auth/teamRequest')) return nextResolve(`${specifier}.ts`, context)
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if ([`${authRoot}api.ts`, `${featureRoot}api.ts`].includes(url)) return { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }), shortCircuit: true }
    return nextLoad(url, context)
  },
})
const { fetchAllTournaments, fetchTournaments, fetchTournament, saveTournament, TournamentRequestError } = await import('../src/features/tournaments/api.ts')
const { SessionExpiredError } = await import('../src/features/auth/api.ts')
const { configureTeamAccess, captureTeamScope } = await import('../src/features/auth/teamRequest.ts')
hooks.deregister()
const user = teamId => ({ username: 'synthetic-coach', authType: 'ACCOUNT', role: 'COACH', serviceAdmin: false, team: { id: teamId }, teams: [] })
const draft = { name: ' 가상 대회 ', startDate: '2028-03-01', endDate: '2028-03-02', venue: '', division: ' 일반부 ', notes: ' 메모 ' }
function setup(t, handler) {
  const previousWindow = globalThis.window; globalThis.window = new EventTarget(); configureTeamAccess(user(11))
  const fetchMock = t.mock.method(globalThis, 'fetch', handler)
  t.after(() => { configureTeamAccess(null); globalThis.window = previousWindow })
  return fetchMock
}
test('all-tournament picker fetches every size-100 page under the same team scope', async t => {
  const fetchMock = setup(t, async path => Response.json({ items: [{ id: path.includes('page=0') ? 1 : 2 }], page: path.includes('page=0') ? 0 : 1, totalPages: 2, totalElements: 2 }))
  assert.deepEqual((await fetchAllTournaments(new AbortController().signal)).map(item => item.id), [1, 2])
  assert.deepEqual(fetchMock.mock.calls.map(call => call.arguments[0]), ['/api/v1/tournaments?page=0&size=100', '/api/v1/tournaments?page=1&size=100'])
  assert.ok(fetchMock.mock.calls.every(call => call.arguments[1].headers.get('X-Team-Id') === '11'))
})
test('tournament update sends the optimistic version and preserves full date range', async t => {
  const fetchMock = setup(t, async path => path.endsWith('/csrf') ? Response.json({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-token' }) : Response.json({ id: 7, version: 3 }))
  await saveTournament(draft, { id: 7, version: 2 }, new AbortController().signal)
  const [path, options] = fetchMock.mock.calls[1].arguments
  assert.equal(path, '/api/v1/tournaments/7'); assert.equal(options.method, 'PUT')
  assert.deepEqual(JSON.parse(options.body), { ...draft, name: '가상 대회', division: '일반부', notes: '메모', version: 2 })
  assert.equal(options.headers.get('X-Team-Id'), '11')
})
test('conflict is a version error without silently retrying the mutation or invalidating the session', async t => {
  const fetchMock = setup(t, async path => path.endsWith('/csrf') ? Response.json({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-token' }) : Response.json({ message: '최신 정보 확인', fieldErrors: {} }, { status: 409 }))
  await assert.rejects(saveTournament(draft, { id: 7, version: 2 }), error => error instanceof TournamentRequestError && error.status === 409)
  assert.equal(fetchMock.mock.calls.length, 2)
  assert.equal(captureTeamScope().teamId, 11)
})
test('team switch rejects an in-flight all-page result before requesting the next page', async t => {
  let complete
  const fetchMock = setup(t, () => new Promise(resolve => { complete = resolve }))
  const pending = fetchAllTournaments(new AbortController().signal)
  configureTeamAccess(user(22)); complete(Response.json({ items: [{ id: 11 }], totalPages: 2 }))
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(fetchMock.mock.calls.length, 1)
})
test('missing tournament is distinguished from expired team access', async t => {
  setup(t, async path => Response.json({}, { status: path.endsWith('/7') ? 404 : 401 }))
  await assert.rejects(fetchTournament(7), error => error instanceof TournamentRequestError && error.status === 404)
  assert.equal(captureTeamScope().teamId, 11)
  await assert.rejects(fetchTournament(8), SessionExpiredError)
})
test('invalid list pagination is rejected before contacting the API', async t => {
  const fetchMock = setup(t, async () => Response.json({}))
  await assert.rejects(fetchTournaments(-1), RangeError)
  await assert.rejects(fetchTournaments(0, undefined, 101), RangeError)
  assert.equal(fetchMock.mock.calls.length, 0)
})
