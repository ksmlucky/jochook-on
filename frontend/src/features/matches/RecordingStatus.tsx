import type { RecordingStage } from './recordingProgress'
import { recordingStageLabel } from './recordingProgress'
import './recording-progress.css'

export function RecordingStatus({ stage, compact = false }: { stage?: RecordingStage | null; compact?: boolean }) {
  const label = recordingStageLabel(stage)
  const visible = !compact || stage === 'COMPLETED' ? label : stage ? `${label.slice(0, 2)} 작성 중` : '기존 기록'
  return <span className={`recording-status ${stage === 'COMPLETED' ? 'is-completed' : stage ? 'is-draft' : 'is-legacy'}`} title={label} aria-label={label}>
    <span aria-hidden="true">{stage === 'COMPLETED' ? '✓' : stage ? '◷' : '—'}</span> {visible}
  </span>
}
