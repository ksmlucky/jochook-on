import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { readFileSync } from 'node:fs'

// Exercise the browser modules unchanged, including extensionless imports and TS parameter properties.
const authRoot = new URL('../src/features/auth/', import.meta.url).href
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(authRoot) && ['./api', './teamScope'].includes(specifier)) {
      return nextResolve(`${specifier}.ts`, context)
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url === `${authRoot}api.ts`) {
      return { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }), shortCircuit: true }
    }
    return nextLoad(url, context)
  },
})
const { AccessRequestError, SessionExpiredError } = await import('../src/features/auth/api.ts')
const { ACCESS_CHANGED_EVENT, configureTeamAccess, captureTeamScope, teamFetch } = await import('../src/features/auth/teamRequest.ts')
const user = teamId => ({ username: 'synthetic-manager', authType: 'ACCOUNT', role: 'DIRECTOR', serviceAdmin: false, team: { id: teamId }, teams: [] })
function setup(t, handler) {
  const events = []
  const browser = new EventTarget()
  browser.addEventListener(ACCESS_CHANGED_EVENT, event => events.push(event.detail))
  const originalWindow = globalThis.window
  globalThis.window = browser
  configureTeamAccess(user(11))
  const fetchMock = t.mock.method(globalThis, 'fetch', handler)
  t.after(() => { configureTeamAccess(null); globalThis.window = originalWindow })
  return { events, fetchMock }
}
for (const status of [401, 403]) {
  test(`CSRF ${status} locks access without sending a mutation`, async t => {
    const { events, fetchMock } = setup(t, async () => Response.json({ code: 'EXPIRED' }, { status }))
    const scope = captureTeamScope()
    await assert.rejects(teamFetch('/api/v1/matches', { method: 'POST' }), SessionExpiredError)
    assert.deepEqual(fetchMock.mock.calls.map(call => call.arguments[0]), ['/api/v1/auth/csrf'])
    assert.equal(events.length, 1)
    assert.equal(scope.controller.signal.aborted, true)
    assert.throws(captureTeamScope, SessionExpiredError)
  })
}
test('a late CSRF error from an old team cannot lock the new team', async t => {
  let finish
  const { events } = setup(t, () => new Promise(resolve => { finish = resolve }))
  const pending = teamFetch('/api/v1/matches', { method: 'POST' })
  configureTeamAccess(user(22))
  finish(Response.json({}, { status: 401 }))
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(captureTeamScope().teamId, 22)
  assert.equal(events.length, 0)
})
test('CSRF service failure stays a request error without invalidating the session', async t => {
  const { events, fetchMock } = setup(t, async () => Response.json({}, { status: 500 }))
  await assert.rejects(teamFetch('/api/v1/matches', { method: 'POST' }), error => error instanceof AccessRequestError && error.status === 500)
  assert.equal(fetchMock.mock.calls.length, 1)
  assert.equal(captureTeamScope().teamId, 11)
  assert.equal(events.length, 0)
})
test('successful CSRF still sends the original team header and mutation exactly once', async t => {
  const { events, fetchMock } = setup(t, async path => path.endsWith('/csrf')
    ? Response.json({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-token' })
    : Response.json({ id: 99 }))
  const response = await teamFetch('/api/v1/matches', { method: 'POST', body: '{}' })
  assert.equal(response.status, 200)
  assert.equal(fetchMock.mock.calls.length, 2)
  const [path, options] = fetchMock.mock.calls[1].arguments
  assert.equal(path, '/api/v1/matches')
  assert.equal(options.headers.get('X-Team-Id'), '11')
  assert.equal(options.headers.get('X-CSRF-TOKEN'), 'synthetic-token')
  assert.equal(events.length, 0)
})
