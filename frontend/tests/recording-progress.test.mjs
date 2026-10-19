import test from 'node:test'
import assert from 'node:assert/strict'
import { recordingStages, recordingStageLabel, resumeStep, stageOnSave } from '../src/features/matches/recordingProgress.ts'
import { matchHistoryChanges } from '../src/features/matches/historyChanges.ts'

test('a normal save always resumes the chosen tab without marking it complete', () => {
  for (let step = 0; step < 4; step++) {
    const checkpoint = stageOnSave(step, 'save')
    assert.equal(checkpoint, recordingStages[step])
    assert.equal(resumeStep(checkpoint), step)
    assert.match(recordingStageLabel(checkpoint), /작성 중/)
  }
})
test('save-and-next records the destination, while copying the plan remains in actual entry', () => {
  assert.equal(stageOnSave(0, 'plan'), 'PLAN')
  assert.equal(stageOnSave(1, 'lineup'), 'ACTUAL')
  assert.equal(stageOnSave(2, 'actual-from-plan'), 'ACTUAL')
  assert.equal(stageOnSave(2, 'totals'), 'RESULT')
  assert.equal(stageOnSave(3, 'complete'), 'COMPLETED')
  assert.equal(resumeStep('COMPLETED'), 3)
})
test('legacy checkpoints are unknown rather than incorrectly completed', () => {
  assert.equal(resumeStep(null), 0)
  assert.equal(resumeStep(undefined), 0)
  assert.equal(recordingStageLabel(null), '기존 기록 · 상태 미지정')
})
test('history includes completion and reopening without inventing changes in old snapshots', () => {
  const base = { kind: 'EXTERNAL', scoreFor: 0, scoreAgainst: 0, participants: [], quarters: [], plannedLineup: [] }
  assert.deepEqual(matchHistoryChanges(base, { ...base, recordingStage: null }), [])
  assert.deepEqual(matchHistoryChanges({ ...base, recordingStage: 'COMPLETED' }, { ...base, recordingStage: 'ACTUAL' }), [
    { label: '작성 상태', before: '기록 완료', after: '02 스쿼드·기록 작성 중' },
  ])
})

test('quarter checkpoints remain in results without completing the match', () => {
  for (let quarter = 1; quarter <= 4; quarter++) {
    assert.equal(stageOnSave(3, `quarter-${quarter}`), 'RESULT')
    assert.equal(resumeStep(stageOnSave(3, `quarter-${quarter}`)), 3)
  }
})
