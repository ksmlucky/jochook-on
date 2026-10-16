import { useId } from 'react'
import { statsDisplayModes } from './scoringMetrics'
import type { StatsDisplayMode } from './scoringMetrics'

export function StatsDisplayControl({ value, onChange }: { value: StatsDisplayMode; onChange: (mode: StatsDisplayMode) => void }) {
  const id = useId()
  return <details className="stats-display-disclosure"><summary>스탯 기준 <strong>{statsDisplayModes[value]}</strong><span>변경</span></summary><div className="stats-display-control"><label htmlFor={`stats-display-${id}`}>스탯 보기<select id={`stats-display-${id}`} value={value} aria-describedby={`stats-display-help-${id}`} onChange={event => onChange(event.target.value as StatsDisplayMode)}>
    {Object.entries(statsDisplayModes).map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}
  </select></label><div id={`stats-display-help-${id}`} className="field-help">
    <p>{value === 'TOTAL' ? '득점·도움·FK·PK는 누적 기록이에요.' : `${statsDisplayModes[value]} 수치는 실제 출전 쿼터로 계산해요. 0쿼터는 —로 표시해요.`}</p>
    <details className="stats-calculation-help"><summary>계산 기준</summary><p>FK(프리킥)·PK(페널티킥)는 총득점의 일부예요. 출전·출석은 항상 누적값이에요.</p>
    <p>대회 전·후반은 각각 1쿼터, 교체한 선수는 각각 0.5쿼터예요. 시간으로 환산하지 않고 합산해요.</p></details>
  </div></div></details>
}
