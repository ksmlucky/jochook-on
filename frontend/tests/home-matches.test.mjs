import test from 'node:test'
import assert from 'node:assert/strict'
import { selectHomeMatches } from '../src/features/home/homeMatches.ts'

test('home preserves the server order and limits recent cards to three', () => {
  const items = Array.from({ length: 12 }, (_, id) => ({ id, recordingStage: 'COMPLETED' }))
  assert.deepEqual(selectHomeMatches(items).recent.map(match => match.id), [0, 1, 2])
  assert.equal(items.length, 12)
})

test('resume shows up to two explicitly unfinished records, excluding legacy unknowns and completed games', () => {
  const items = [null, undefined, 'COMPLETED', 'PLAN', 'ACTUAL', 'RESULT', 'ATTENDANCE'].map((recordingStage, id) => ({ id, recordingStage }))
  assert.deepEqual(selectHomeMatches(items).unfinished.map(match => match.id), [3, 4])
  assert.deepEqual(selectHomeMatches([{ recordingStage: null }, { recordingStage: 'COMPLETED' }]).unfinished, [])
})

test('home never implies an older unfinished game is part of the first page', () => {
  const items = Array.from({ length: 10 }, () => ({ recordingStage: 'COMPLETED' }))
  items.push({ recordingStage: 'PLAN' })
  assert.deepEqual(selectHomeMatches(items).unfinished, [])
  assert.deepEqual(selectHomeMatches([]), { recent: [], unfinished: [] })
})
