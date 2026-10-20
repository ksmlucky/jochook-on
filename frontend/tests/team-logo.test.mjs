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
const { getTeamLogo, updateTeamLogo, validateLogoFile, TEAM_LOGO_CHANGED } = await import('../src/features/teams/teamLogo.ts')
const { configureTeamAccess, captureTeamScope } = await import('../src/features/auth/teamRequest.ts')
const { SessionExpiredError } = await import('../src/features/auth/api.ts')
hooks.deregister()
const user = teamId => ({ username: 'fixture-director', authType: 'ACCOUNT', role: 'DIRECTOR', serviceAdmin: false, team: { id: teamId }, teams: [] })
function setup(t, handler) {
  const previous = globalThis.window; globalThis.window = new EventTarget(); configureTeamAccess(user(11))
  t.after(() => { configureTeamAccess(null); globalThis.window = previous })
  return t.mock.method(globalThis, 'fetch', handler)
}
test('bad file types and empty/oversize files are rejected before upload', () => {
  assert.equal(validateLogoFile({ type: 'image/png', size: 2 * 1024 * 1024 }), null)
  for (const file of [{ type: 'image/svg+xml', size: 20 }, { type: 'image/png', size: 0 }, { type: 'image/jpeg', size: 2097153 }]) assert.ok(validateLogoFile(file))
})
test('repeated badges share one scoped fetch and a missing logo is a normal placeholder', async t => {
  const fetch = setup(t, async () => new Response(null, { status: 404 }))
  assert.deepEqual(await Promise.all([getTeamLogo(11), getTeamLogo(11)]), [null, null])
  assert.equal(fetch.mock.calls.length, 1)
  assert.equal(fetch.mock.calls[0].arguments[1].headers.get('X-Team-Id'), '11')
  assert.equal(fetch.mock.calls[0].arguments[1].cache, 'no-store')
})
test('a late prior-team image cannot be returned after switching', async t => {
  let finish
  setup(t, () => new Promise(resolve => { finish = resolve }))
  const pending = getTeamLogo(11)
  configureTeamAccess(user(22)); finish(new Response('fixture png'))
  await assert.rejects(pending, { name: 'AbortError' })
  await assert.rejects(getTeamLogo(11), { name: 'AbortError' })
})
test('upload sends CSRF and scoped multipart, then invalidates cached badge', async t => {
  const fetch = setup(t, async (path, options) => path.endsWith('/csrf') ? Response.json({ headerName: 'X-CSRF-TOKEN', token: 'fixture' }) : options.method ? new Response(null, { status: 204 }) : new Response('png'))
  await getTeamLogo(11)
  let changed = 0; window.addEventListener(TEAM_LOGO_CHANGED, () => changed++)
  const file = new File(['png'], 'fixture.png', { type: 'image/png' })
  await updateTeamLogo(file)
  await getTeamLogo(11)
  const upload = fetch.mock.calls.find(call => call.arguments[1]?.method === 'PUT').arguments[1]
  assert.equal(upload.headers.get('X-Team-Id'), '11'); assert.equal(upload.headers.get('X-CSRF-TOKEN'), 'fixture')
  assert.equal(upload.body.get('file'), file); assert.equal(changed, 1)
  assert.equal(fetch.mock.calls.filter(call => call.arguments[0].endsWith('/logo') && !call.arguments[1].method).length, 2)
})
test('expired logo requests lock access instead of exposing a cached image', async t => {
  setup(t, async () => Response.json({}, { status: 401 }))
  await assert.rejects(getTeamLogo(11), SessionExpiredError)
  assert.throws(captureTeamScope, SessionExpiredError)
})
