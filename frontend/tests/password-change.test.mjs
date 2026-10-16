import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { readFileSync } from 'node:fs'
const apiUrl = new URL('../src/features/auth/api.ts', import.meta.url).href
registerHooks({
  load(url, context, nextLoad) {
    if (url === apiUrl) return { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }), shortCircuit: true }
    return nextLoad(url, context)
  },
})
const { AccessRequestError } = await import('../src/features/auth/api.ts')
const { changePassword, passwordChangeError, passwordChangeValidation } = await import('../src/features/auth/passwordChange.ts')

test('password changes require current value, a different long password and matching confirmation', () => {
  assert.match(passwordChangeValidation('', 'new-password-12', 'new-password-12'), /현재 비밀번호/)
  assert.match(passwordChangeValidation('old-password', 'short', 'short'), /12자/)
  assert.match(passwordChangeValidation('same-password12', 'same-password12', 'same-password12'), /다른/)
  assert.match(passwordChangeValidation('old-password', 'new-password-12', 'other'), /일치/)
  assert.equal(passwordChangeValidation('old-password', 'new-password-12', 'new-password-12'), '')
})

test('UTF-8 byte limit rejects long multilingual passwords without trimming or truncating values', () => {
  const accepted = '가'.repeat(24)
  const rejected = '가'.repeat(25)
  assert.equal(passwordChangeValidation('old-password', accepted, accepted), '')
  assert.match(passwordChangeValidation('old-password', rejected, rejected), /72바이트/)
  assert.equal(passwordChangeValidation('old-password', 'x'.repeat(72), 'x'.repeat(72)), '')
  assert.match(passwordChangeValidation('old-password', 'x'.repeat(73), 'x'.repeat(73)), /72바이트/)
  assert.match(passwordChangeValidation('old-password', '⚽'.repeat(11), '⚽'.repeat(11)), /12자/)
  assert.match(passwordChangeValidation('old-password', '😀'.repeat(6), '😀'.repeat(6)), /12자/)
  assert.equal(passwordChangeValidation('old-password', '😀'.repeat(12), '😀'.repeat(12)), '')
})

test('password request uses CSRF and sends only current and new passwords', async () => {
  const original = globalThis.fetch
  const requests = []
  globalThis.fetch = async (path, options) => {
    requests.push({ path, options })
    return path.endsWith('/csrf') ? Response.json({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' }) : new Response(null, { status: 204 })
  }
  try {
    await changePassword('synthetic-old', 'synthetic-new-value')
    assert.equal(requests.length, 2)
    assert.equal(requests[1].path, '/api/v1/auth/password/change')
    assert.equal(requests[1].options.method, 'POST')
    assert.equal(requests[1].options.headers.get('X-CSRF-TOKEN'), 'synthetic-csrf')
    assert.deepEqual(JSON.parse(requests[1].options.body), { currentPassword: 'synthetic-old', newPassword: 'synthetic-new-value' })
  } finally { globalThis.fetch = original }
})

test('lost response is not retried and warns that the change may have succeeded', async () => {
  const original = globalThis.fetch
  let mutations = 0
  globalThis.fetch = async path => {
    if (path.endsWith('/csrf')) return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' })
    mutations++; throw new TypeError('synthetic connection loss')
  }
  try { await assert.rejects(changePassword('synthetic-old', 'synthetic-new-value'), TypeError); assert.equal(mutations, 1) }
  finally { globalThis.fetch = original }
  assert.match(passwordChangeError(new TypeError('network')), /이미 변경/)
  assert.match(passwordChangeError(new AccessRequestError('server', 500, 'SERVER_ERROR')), /새 비밀번호로 로그인/)
})

test('expected failures show safe actionable text, without echoing server detail', () => {
  assert.match(passwordChangeError(new AccessRequestError('detail', 400, 'CURRENT_PASSWORD_INCORRECT')), /현재 비밀번호가 맞지/)
  assert.match(passwordChangeError(new AccessRequestError('detail', 400, 'PASSWORD_UNCHANGED')), /다른/)
  assert.match(passwordChangeError(new AccessRequestError('detail', 401, 'UNAUTHENTICATED')), /로그인이 만료/)
  assert.match(passwordChangeError(new AccessRequestError('detail', 403, 'FORBIDDEN')), /개인 계정/)
  assert.match(passwordChangeError(new AccessRequestError('detail', 429, 'RATE_LIMITED', 60)), /기다려/)
})
