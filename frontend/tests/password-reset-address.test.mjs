import test from 'node:test'
import assert from 'node:assert/strict'
import {consumePasswordResetAddress} from '../src/features/auth/passwordResetAddress.ts'
test('reset fragment is removed immediately without writing the token to the replacement URL', () => {
  const token='a'.repeat(43), replacements=[]
  const result=consumePasswordResetAddress(new URL(`https://example.test/app/#reset=${token}`),v=>replacements.push(v))
  assert.equal(result,token)
  assert.deepEqual(replacements,['/app/#access'])
})
test('invalid reset links are scrubbed and remain distinct from ordinary navigation', () => {
  const replacements=[]
  assert.equal(consumePasswordResetAddress(new URL('https://example.test/#reset=bad'),v=>replacements.push(v)),'')
  assert.deepEqual(replacements,['/#access'])
  assert.equal(consumePasswordResetAddress(new URL('https://example.test/#matches'),()=>assert.fail('unexpected replacement')),null)
})
