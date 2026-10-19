import { useState } from 'react'
import type { MatchDraft, MatchTeam } from './api'
import { changeFormation, formationFor, formationLabel, formationOptions, formations, removedPlanCount } from './formations'
import type { Formation } from './formations'
import './formations.css'
import { matchPeriodSummary } from './matchFormat'

export function FormationSelector({ draft, editable, onChange }: { draft: MatchDraft; editable: boolean; onChange: (draft: MatchDraft) => void }) {
  const [pending, setPending] = useState<{ team: MatchTeam; formation: Formation } | null>(null)
  const [error, setError] = useState('')
  function apply(team: MatchTeam, formation: Formation) {
    try { onChange(changeFormation(draft, team, formation)); setPending(null); setError('') }
    catch (cause) { setPending(null); setError(cause instanceof Error ? cause.message : '포메이션을 변경하지 못했습니다.') }
  }
  return <section className="formation-settings" aria-labelledby="formation-settings-title">
    <h4 id="formation-settings-title">포메이션</h4>
    <p className="field-help">팀별로 선택한 포메이션을 {matchPeriodSummary(draft.matchFormat)} 스쿼드에 사용해요.</p>
    <div className="formation-fields">{(draft.kind === 'INTERNAL' ? ['A', 'B'] as const : ['A'] as const).map(team => {
      const current = formationFor(draft, team)
      const locked = draft.quarters.some(q => q.lineup.some(entry => entry.team === team))
      const label = draft.kind === 'INTERNAL' ? `${team}팀 포메이션` : '우리 팀 포메이션'
      return <div key={team}>
        <label htmlFor={`formation-${team}`}>{label}</label>
        <select id={`formation-${team}`} value={current} disabled={!editable || locked} aria-describedby={`formation-help-${team}`} onChange={event => {
          const next = event.target.value as Formation
          setError('')
          if (next === current) { setPending(null); return }
          if (draft.plannedLineup.some(entry => entry.team === team)) setPending({ team, formation: next })
          else apply(team, next)
        }}>{formationOptions.map(value => <option key={value} value={value}>{formations[value].label}{value === 'F4123' ? ' · 기본' : ''}</option>)}</select>
        <small id={`formation-help-${team}`}>{formations[current].description}{locked && ' · 실제 출전 기록이 있어 변경을 잠갔습니다. 변경하려면 02에서 해당 팀의 기록을 확인하고 직접 배치를 해제하세요.'}</small>
      </div>
    })}</div>
    {pending && <div className="conflict-notice" role="alert">
      <p>{draft.kind === 'INTERNAL' ? `${pending.team}팀을` : '포메이션을'} <strong>{formationLabel(pending.formation)}</strong>(으)로 변경할까요? 공통 자리의 선수 배치는 유지하고, 새 구성에 없는 자리의 <strong>배치 {removedPlanCount(draft, pending.team, pending.formation)}건</strong>은 해제합니다. 해제된 선수는 참석 명단에 남아 다시 배치할 수 있습니다.</p>
      <div className="registration-actions"><button type="button" className="primary-button" disabled={!editable} onClick={() => apply(pending.team, pending.formation)}>포메이션 변경</button><button type="button" className="secondary-button" disabled={!editable} onClick={() => setPending(null)}>기존 포메이션 유지</button></div>
    </div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>
}
