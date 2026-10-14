export const recordingStages = ['ATTENDANCE', 'PLAN', 'ACTUAL', 'RESULT'] as const
export type RecordingStage = typeof recordingStages[number] | 'COMPLETED'
const labels: Record<RecordingStage, string> = {
  ATTENDANCE: '01 투표·출석 작성 중', PLAN: '02 스쿼드 계획 작성 중',
  ACTUAL: '03 실제 출전 작성 중', RESULT: '04 결과·코멘트 작성 중', COMPLETED: '기록 완료',
}
export const recordingStageLabel = (stage?: RecordingStage | null) => stage ? labels[stage] : '기존 기록 · 상태 미지정'
export function resumeStep(stage?: RecordingStage | null): number {
  return stage === 'COMPLETED' ? 3 : Math.max(0, recordingStages.findIndex(value => value === stage))
}
export function stageOnSave(step: number, destination: string): RecordingStage {
  if (destination === 'complete') return 'COMPLETED'
  if (destination === 'plan') return 'PLAN'
  if (destination === 'lineup' || destination === 'actual-from-plan') return 'ACTUAL'
  if (destination === 'totals') return 'RESULT'
  return recordingStages[step] ?? 'ATTENDANCE'
}
