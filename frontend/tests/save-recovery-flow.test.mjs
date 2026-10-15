import test from 'node:test'
import assert from 'node:assert/strict'
import { pendingSaveFailureDisposition, resolvePendingSave, SaveResultChangedError } from '../src/features/matches/saveRecoveryFlow.ts'
import { toMatchPayload } from '../src/features/matches/matchPayload.ts'

const base = {
  id: 10, version: 3, kind: 'EXTERNAL', formationA: 'F352', formationB: 'F4123',
  playedOn: '2026-10-15', kickoff: '11:00', venue: '검증 구장', opponent: '검증 상대', notes: '초안',
  scoreFor: 0, scoreAgainst: 0, recordingStage: 'ACTUAL',
  participants: [{ playerId: 1, name: '가상 선수', shirtNumber: 7, birthYear: 1996, playerType: 'MEMBER', vote: 'ATTENDING', attendance: 'PRESENT' }],
  quarters: [1, 2, 3, 4].map(number => ({ number, lineup: [] })), plannedLineup: [],
}
const pending = { key: 'ddbb6fa9-d85e-4a70-9894-87c7b281b344', draft: structuredClone(base), record: structuredClone(base), destination: 'totals' }

test('a saved receipt restores the current record without repeating the save', async () => {
  const calls = []
  const expected = { ...base, version: 4 }
  const result = await resolvePendingSave(pending, {
    receipt: async key => { calls.push(['receipt', key]); return { matchId: 10, version: 4, exists: true } },
    save: async () => { throw new Error('must not save twice') },
    match: async id => { calls.push(['match', id]); return expected },
  })
  assert.equal(result, expected)
  assert.deepEqual(calls, [['receipt', pending.key], ['match', 10]])
})

test('only an explicitly missing receipt permits resend with the identical frozen request', async () => {
  const calls = []
  const before = structuredClone(pending)
  const result = await resolvePendingSave(pending, {
    receipt: async () => null,
    save: async request => { assert.equal(request, pending); calls.push('save'); return { ...base, version: 4 } },
    match: async id => { assert.equal(id, 10); calls.push('match'); return { ...base, version: 4 } },
  })
  assert.equal(result.version, 4)
  assert.deepEqual(pending, before)
  assert.deepEqual(calls, ['save', 'match'])
})

test('network or session failure while reading a receipt never triggers a save', async () => {
  for (const failure of [new TypeError('offline'), new Error('session expired')]) {
    await assert.rejects(resolvePendingSave(pending, {
      receipt: async () => { throw failure }, save: async () => assert.fail('unexpected save'), match: async () => assert.fail('unexpected query'),
    }), error => error === failure)
  }
})

test('a later version or deleted receipt preserves the pending request and blocks success', async () => {
  await assert.rejects(resolvePendingSave(pending, {
    receipt: async () => ({ matchId: 10, version: 4, exists: false }),
    save: async () => assert.fail('unexpected save'), match: async () => assert.fail('unexpected query'),
  }), SaveResultChangedError)
  await assert.rejects(resolvePendingSave(pending, {
    receipt: async () => ({ matchId: 10, version: 4, exists: true }),
    save: async () => assert.fail('unexpected save'), match: async () => ({ ...base, version: 5 }),
  }), SaveResultChangedError)
})

test('a replay response is still checked against later server changes before applying it', async () => {
  await assert.rejects(resolvePendingSave(pending, {
    receipt: async () => null,
    save: async () => ({ ...base, version: 4 }),
    match: async () => ({ ...base, version: 5 }),
  }), SaveResultChangedError)
})

test('another response loss can be retried later without changing the key or body', async () => {
  let first = true
  const submitted = []
  const transport = {
    receipt: async () => null,
    save: async request => {
      submitted.push({ key: request.key, body: JSON.stringify(toMatchPayload(request.draft, request.record)) })
      if (first) { first = false; throw new TypeError('response lost') }
      return { ...base, version: 4 }
    },
    match: async () => ({ ...base, version: 4 }),
  }
  await assert.rejects(resolvePendingSave(pending, transport), TypeError)
  await resolvePendingSave(pending, transport)
  assert.deepEqual(submitted[0], submitted[1])
})

test('payload strips display-only player data and retains the original optimistic version', () => {
  const result = toMatchPayload(pending.draft, pending.record)
  assert.deepEqual(result.participants, [{ playerId: 1, vote: 'ATTENDING', attendance: 'PRESENT' }])
  assert.equal(result.version, 3)
  assert.equal(result.formationA, 'F352')
  assert.equal(result.recordingStage, 'ACTUAL')
  assert.equal('id' in result, false)
  assert.equal(toMatchPayload(pending.draft, null).version, null)
})

test('only a definite initial mutation rejection releases the pending request for editing', () => {
  for (const status of [400, 422, 429]) {
    assert.equal(pendingSaveFailureDisposition('initial-save', status), 'editable')
    assert.equal(pendingSaveFailureDisposition('recovery', status), 'pending')
  }
  for (const attempt of ['initial-save', 'recovery']) {
    for (const status of [undefined, 401, 403, 500, 503]) assert.equal(pendingSaveFailureDisposition(attempt, status), 'pending')
    for (const status of [404, 409]) assert.equal(pendingSaveFailureDisposition(attempt, status), 'blocked')
  }
})

test('receipt read failures keep the original request and cannot unlock a new-key save', async () => {
  const before = structuredClone(pending)
  for (const status of [400, 401, 403, 422, 429, 503]) {
    const failure = Object.assign(new Error('receipt read rejected'), { status })
    await assert.rejects(resolvePendingSave(pending, {
      receipt: async () => { throw failure },
      save: async () => assert.fail('must not resend after a failed read'),
      match: async () => assert.fail('must not query after receipt rejection'),
    }), error => {
      assert.equal(error, failure)
      assert.equal(pendingSaveFailureDisposition('recovery', error.status), 'pending')
      return true
    })
  }
  assert.deepEqual(pending, before)
})

test('record reads after a successful receipt keep the key on permission failure and block on deletion', async () => {
  const before = structuredClone(pending)
  for (const status of [400, 403, 404]) {
    const failure = Object.assign(new Error('record read rejected'), { status })
    await assert.rejects(resolvePendingSave(pending, {
      receipt: async () => ({ matchId: 10, version: 4, exists: true }),
      save: async () => assert.fail('receipt already confirms a saved result'),
      match: async () => { throw failure },
    }), error => {
      assert.equal(error, failure)
      assert.equal(pendingSaveFailureDisposition('recovery', error.status), status === 404 ? 'blocked' : 'pending')
      return true
    })
  }
  assert.deepEqual(pending, before)
})
