import type { RecordingStage } from './recordingProgress'
import { recordingStageLabel } from './recordingProgress'
import './recording-progress.css'

export function RecordingStatus({ stage }: { stage?: RecordingStage | null }) {
  return <span className={`recording-status ${stage === 'COMPLETED' ? 'is-completed' : stage ? 'is-draft' : 'is-legacy'}`}>
    <span aria-hidden="true">{stage === 'COMPLETED' ? '✓' : stage ? '◷' : '—'}</span> {recordingStageLabel(stage)}
  </span>
}
