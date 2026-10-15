import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyTournament, tournamentDateRange, tournamentDraft, validateTournament } from '../src/features/tournaments/types.ts'

const valid = () => ({ name: '가상 봄 대회', startDate: '2028-02-29', endDate: '2028-02-29', venue: '', division: '', notes: '' })
test('tournament name and both real calendar dates are required; optional fields may stay empty', () => {
  assert.deepEqual(validateTournament(valid()), {})
  const errors = validateTournament(emptyTournament())
  assert.deepEqual(Object.keys(errors), ['name', 'startDate', 'endDate'])
  assert.ok(validateTournament({ ...valid(), name: '　 ' }).name)
  assert.ok(validateTournament({ ...valid(), startDate: '2027-02-29' }).startDate)
  assert.ok(validateTournament({ ...valid(), endDate: '2028-02-30' }).endDate)
  assert.ok(validateTournament({ ...valid(), startDate: '2028-04-31' }).startDate)
})
test('tournament end date cannot precede start date; same-day and multi-day events are supported', () => {
  assert.ok(validateTournament({ ...valid(), endDate: '2028-02-28' }).endDate)
  assert.deepEqual(validateTournament({ ...valid(), endDate: '2028-03-01' }), {})
  assert.equal(tournamentDateRange(valid()), '2028-02-29')
  assert.equal(tournamentDateRange({ ...valid(), endDate: '2028-03-01' }), '2028-02-29 ~ 2028-03-01')
})
test('tournament field limits apply without silently truncating notes or division', () => {
  const atLimit = { ...valid(), name: '대'.repeat(120), venue: '장'.repeat(120), division: '부'.repeat(80), notes: '메'.repeat(3000) }
  assert.deepEqual(validateTournament(atLimit), {})
  for (const field of ['name', 'venue', 'division', 'notes']) assert.ok(validateTournament({ ...atLimit, [field]: atLimit[field] + '추가' })[field])
})
test('editing extracts only tournament fields and keeps the original versioned record untouched', () => {
  const record = { ...valid(), id: 7, version: 4, matchCount: 2, ignored: 'not a draft field' }
  const draft = tournamentDraft(record)
  draft.notes = '검토 중 메모'
  assert.equal(record.notes, '')
  assert.equal('id' in draft || 'version' in draft || 'matchCount' in draft || 'ignored' in draft, false)
})
