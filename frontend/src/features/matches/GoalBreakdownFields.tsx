import type { Appearance } from './api'
import { goalBreakdownText } from './goalBreakdown'
import './goal-breakdown.css'

export function GoalBreakdownFields({ entry, label, editable, expanded = false, onChange }: {
  entry: Appearance; label: string; editable: boolean; expanded?: boolean
  onChange: (patch: Partial<Appearance>) => void
}) {
  return <details className="goal-breakdown" open={expanded || undefined}>
    <summary>득점 세부 기록 <small>{goalBreakdownText(entry)}</small></summary>
    {editable && <div className="goal-breakdown-inputs">
      <label>직접 프리킥<input aria-label={`${label} 직접 프리킥 득점`} type="number" inputMode="numeric" min={0} max={99} step={1} required
        value={entry.freeKickGoals ?? 0} onChange={event => onChange({ freeKickGoals: event.target.valueAsNumber })} /></label>
      <label>PK<input aria-label={`${label} PK 득점`} type="number" inputMode="numeric" min={0} max={99} step={1} required
        value={entry.penaltyGoals ?? 0} onChange={event => onChange({ penaltyGoals: event.target.valueAsNumber })} /></label>
    </div>}
    <p>총 골에 포함된 득점이에요. 직접 프리킥과 경기 중 PK만 입력하며, 승부차기는 제외해요. 일반 골은 자동 계산해요.</p>
  </details>
}
