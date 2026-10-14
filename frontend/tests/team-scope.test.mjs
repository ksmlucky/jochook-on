import test from 'node:test'
import assert from 'node:assert/strict'
import { TeamScopeStore } from '../src/features/auth/teamScope.ts'

test('team changes abort pending requests and never reuse the old team snapshot', async () => {
  const scopes = new TeamScopeStore()
  scopes.configure('ACCOUNT:manager:11:ADMIN', 11)
  const old = scopes.snapshot()
  const delayedResult = Promise.resolve().then(() => scopes.accepts(old))
  scopes.configure('ACCOUNT:manager:22:ADMIN', 22)
  assert.equal(await delayedResult, false)
  assert.equal(old.teamId, 11)
  assert.equal(old.controller.signal.aborted, true)
  assert.equal(scopes.snapshot().teamId, 22)
  scopes.configure('ACCOUNT:manager:11:ADMIN', 11)
  assert.equal(scopes.accepts(old), false)
  assert.notEqual(scopes.snapshot(), old)
})

test('changing access mode on the same team discards requests made with earlier permissions', () => {
  const scopes = new TeamScopeStore()
  scopes.configure('ACCOUNT:manager:11:ADMIN', 11)
  const adminRequest = scopes.snapshot()
  scopes.configure('TEAM_CODE::11:MEMBER', 11)
  assert.equal(scopes.accepts(adminRequest), false)
  assert.equal(adminRequest.controller.signal.aborted, true)
  assert.equal(scopes.accepts(scopes.snapshot()), true)
})

test('an unchanged authentication refresh preserves requests, but locked access requires a new snapshot', () => {
  const scopes = new TeamScopeStore()
  scopes.configure('ACCOUNT:manager:11:ADMIN', 11)
  const original = scopes.snapshot()
  scopes.configure('ACCOUNT:manager:11:ADMIN', 11)
  assert.equal(scopes.snapshot(), original)
  scopes.invalidate()
  assert.equal(scopes.accepts(original), false)
  scopes.configure('ACCOUNT:manager:11:ADMIN', 11)
  assert.notEqual(scopes.snapshot(), original)
  assert.equal(scopes.accepts(scopes.snapshot()), true)
})

test('logout or missing team selection aborts and removes the team scope', () => {
  const scopes = new TeamScopeStore()
  scopes.configure('ACCOUNT:manager:11:ADMIN', 11)
  const old = scopes.snapshot()
  scopes.configure('anonymous', null)
  assert.equal(scopes.snapshot(), null)
  assert.equal(old.controller.signal.aborted, true)
  assert.equal(scopes.accepts(old), false)
})
