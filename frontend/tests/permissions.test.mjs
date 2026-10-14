import test from 'node:test'
import assert from 'node:assert/strict'
import { canEditTeam, canManageCoaches } from '../src/features/auth/permissions.ts'
import { TeamScopeStore } from '../src/features/auth/teamScope.ts'

const account = role => ({ authType: 'ACCOUNT', role, team: { id: 11, status: 'ACTIVE' }, serviceAdmin: false })

test('director manages records and coaches, while coach manages records only', () => {
  assert.equal(canEditTeam(account('DIRECTOR')), true)
  assert.equal(canManageCoaches(account('DIRECTOR')), true)
  assert.equal(canEditTeam(account('COACH')), true)
  assert.equal(canManageCoaches(account('COACH')), false)
})

test('service administration and player display role do not grant record or coach management', () => {
  for (const user of [account('MEMBER'), { ...account('MEMBER'), serviceAdmin: true }, { ...account('MEMBER'), clubRole: '감독' }, account('ADMIN')]) {
    assert.equal(canEditTeam(user), false)
    assert.equal(canManageCoaches(user), false)
  }
})

test('team-code sessions and missing or inactive teams never receive write controls', () => {
  for (const user of [null, undefined, { ...account('DIRECTOR'), authType: 'TEAM_CODE' }, { ...account('COACH'), team: null }, { ...account('DIRECTOR'), team: { status: 'INACTIVE' } }]) {
    assert.equal(canEditTeam(user), false)
    assert.equal(canManageCoaches(user), false)
  }
})

test('director downgrade aborts pending team operations and drops coach management', () => {
  const scopes = new TeamScopeStore()
  const before = account('DIRECTOR')
  scopes.configure('ACCOUNT:manager:11:DIRECTOR:false', 11)
  const request = scopes.snapshot()
  const after = { ...before, role: 'COACH' }
  scopes.configure('ACCOUNT:manager:11:COACH:false', 11)
  assert.equal(request.controller.signal.aborted, true)
  assert.equal(scopes.accepts(request), false)
  assert.equal(canManageCoaches(after), false)
  assert.equal(canEditTeam(after), true)
})

test('coach demotion preserves a fresh read scope but invalidates pending writes', () => {
  const scopes = new TeamScopeStore()
  scopes.configure('ACCOUNT:manager:11:COACH:false', 11)
  const pending = scopes.snapshot()
  scopes.configure('ACCOUNT:manager:11:MEMBER:false', 11)
  assert.equal(pending.controller.signal.aborted, true)
  assert.equal(scopes.accepts(pending), false)
  assert.equal(scopes.accepts(scopes.snapshot()), true)
  assert.equal(canEditTeam(account('MEMBER')), false)
})
