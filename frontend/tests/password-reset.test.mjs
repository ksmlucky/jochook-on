import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { readFileSync } from 'node:fs'
const apiUrl = new URL('../src/features/auth/api.ts', import.meta.url).href
registerHooks({ load(url, context, nextLoad) {
  if (url === apiUrl) return { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }), shortCircuit: true }
  return nextLoad(url, context)
} })
const { AccessRequestError } = await import('../src/features/auth/api.ts')
const { findRecoveryAccounts, issueResetLink, inspectResetLink, completePasswordReset, resetPasswordValidation, resetLinkUrl, resetRequestMessage } = await import('../src/features/auth/passwordReset.ts')

test('reset password uses code points and the 72 UTF-8 byte limit with matching confirmation', () => {
  assert.match(resetPasswordValidation('😀'.repeat(6), '😀'.repeat(6)), /12자/)
  assert.equal(resetPasswordValidation('😀'.repeat(12), '😀'.repeat(12)), '')
  assert.equal(resetPasswordValidation('가'.repeat(24), '가'.repeat(24)), '')
  assert.match(resetPasswordValidation('가'.repeat(25), '가'.repeat(25)), /72바이트/)
  assert.match(resetPasswordValidation('synthetic-password', 'different'), /일치/)
})

test('recovery links keep the token in the fragment, never query parameters', () => {
  const url = new URL(resetLinkUrl('https://example.invalid', '/app/', 'synthetic/token+value'))
  assert.equal(url.pathname, '/app/')
  assert.equal(url.search, '')
  assert.equal(url.hash, '#reset=synthetic%2Ftoken%2Bvalue')
})

test('account search encodes the query and reads the agreed direct-array response', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async (path, options) => {
    assert.equal(new URL(path, 'https://example.invalid').searchParams.get('query'), 'example coach&x')
    assert.equal(options.cache, 'no-store')
    return Response.json([{ id: 12, username: 'example-coach', teams: [{ teamId: 1, teamName: '예시FC', role: 'COACH' }] }])
  }
  try { assert.equal((await findRecoveryAccounts('example coach&x'))[0].teams[0].role, 'COACH') }
  finally { globalThis.fetch = original }
})

test('issue, inspect and complete use CSRF-protected POST bodies without exposing tokens in URLs', async () => {
  const original = globalThis.fetch
  const writes = []
  globalThis.fetch = async (path, options) => {
    if (path.endsWith('/csrf')) return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' })
    writes.push({ path, options })
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.get('X-CSRF-TOKEN'), 'synthetic-csrf')
    assert.equal(path.includes('synthetic-reset-token'), false)
    return path.endsWith('/complete') ? new Response(null, { status: 204 }) : Response.json({ token: 'synthetic-reset-token', username: 'example-coach', expiresAt: '2026-10-16T05:00:00Z' })
  }
  try {
    await issueResetLink(12)
    await inspectResetLink('synthetic-reset-token')
    await completePasswordReset('synthetic-reset-token', 'synthetic-new-password')
    assert.equal(writes.length, 3)
    assert.deepEqual(JSON.parse(writes[0].options.body), { identityVerified: true })
    assert.deepEqual(JSON.parse(writes[1].options.body), { token: 'synthetic-reset-token' })
    assert.deepEqual(JSON.parse(writes[2].options.body), { token: 'synthetic-reset-token', newPassword: 'synthetic-new-password' })
  } finally { globalThis.fetch = original }
})

test('lost reset response is not retried and unclear outcomes have distinct guidance', async () => {
  const original = globalThis.fetch
  let writes = 0
  globalThis.fetch = async path => {
    if (path.endsWith('/csrf')) return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' })
    writes++; throw new TypeError('synthetic lost response')
  }
  try { await assert.rejects(completePasswordReset('synthetic-reset-token', 'synthetic-new-password'), TypeError); assert.equal(writes, 1) }
  finally { globalThis.fetch = original }
  assert.match(resetRequestMessage(new TypeError(), 'complete'), /새 비밀번호로 로그인을 확인/)
  assert.match(resetRequestMessage(new TypeError(), 'issue'), /이전 링크는 사용할 수 없/)
  assert.match(resetRequestMessage(new AccessRequestError('secret backend detail', 400, 'RESET_LINK_INVALID'), 'inspect'), /이미 사용했거나 만료/)
  assert.equal(resetRequestMessage(new AccessRequestError('secret backend detail', 400, 'RESET_LINK_INVALID'), 'inspect').includes('secret'), false)
})
