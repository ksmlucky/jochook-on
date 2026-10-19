import type { Appearance, MatchDraft, MatchTeam } from './api'
import { playerLabel } from './api'
import { GoalEventsEditor } from './GoalEventsEditor'
import { GoalBreakdownFields } from './GoalBreakdownFields'
import { quarterLabel, quarterNumbers } from './matchFormat'
import { TeamSelector } from './TeamSelector'

export function MatchResultGoals({ draft, quarter, team, editable, isAdmin, setQuarter, setTeam, onChange, onSave }: {
  draft: MatchDraft; quarter: number; team: MatchTeam; editable: boolean; isAdmin: boolean
  setQuarter: (number: number) => void; setTeam: (team: MatchTeam) => void
  onChange: (draft: MatchDraft) => void; onSave: () => void
}) {
  const internal = draft.kind === 'INTERNAL'
  const current = draft.quarters.find(q => q.number === quarter)!
  function editLegacy(number: number, playerId: number, patch: Partial<Appearance>) {
    onChange({ ...draft, quarters: draft.quarters.map(q => q.number !== number ? q : { ...q, lineup: q.lineup.map(a => a.playerId === playerId ? { ...a, ...patch } : a) }) })
  }
  return <section aria-label="쿼터별 득점 입력">
    <div className="quarter-tabs" role="group" aria-label="골 기록 쿼터 선택">{quarterNumbers(draft.matchFormat).map(n => <button type="button" key={n} aria-pressed={quarter === n} onClick={() => setQuarter(n)}>{quarterLabel(n, draft.matchFormat)}</button>)}</div>
    {internal && <TeamSelector team={team} onChange={setTeam} disabled={!editable && isAdmin} label="골 입력 팀" counts={{ A: current.lineup.filter(a => a.team === 'A').length, B: current.lineup.filter(a => a.team === 'B').length }} />}
    {draft.quarters.map(q => <div key={`${draft.kind}-${draft.matchFormat}-${q.number}`} hidden={q.number !== quarter}>
      <GoalEventsEditor quarter={q} participants={draft.participants} team={team} internal={internal} editable={editable} matchFormat={draft.matchFormat}
        onChange={next => onChange({ ...draft, quarters: draft.quarters.map(item => item.number === next.number ? next : item) })} />
      {isAdmin && !Array.isArray(q.goalEvents) && q.lineup.some(a => a.goals || a.assists) && <details className="legacy-goal-edit"><summary>기존 선수별 골·도움 수정</summary>
        <p className="field-help">예전 합계 기록을 정정할 때 사용해요. 골별 기록으로 연결한 뒤에는 위에서 수정해 주세요.</p>
        {q.lineup.filter(a => a.team === team).map(a => { const player = draft.participants.find(p => p.playerId === a.playerId); const name = player ? playerLabel(player) : '선수 확인 필요'; return <fieldset key={a.playerId} disabled={!editable}><legend>{name}</legend><div className="goal-event-fields">
          <label>총 골<input aria-label={`${name} 총 골`} type="number" min={0} max={99} step={1} value={a.goals} onChange={e => editLegacy(q.number, a.playerId, { goals: e.target.valueAsNumber })} /></label>
          <label>도움<input aria-label={`${name} 도움`} type="number" min={0} max={99} step={1} value={a.assists} onChange={e => editLegacy(q.number, a.playerId, { assists: e.target.valueAsNumber })} /></label></div>
          <GoalBreakdownFields entry={a} label={name} editable={editable} onChange={patch => editLegacy(q.number, a.playerId, patch)} /></fieldset> })}
      </details>}
    </div>)}
    {isAdmin && <div className="quarter-record-save"><button type="button" className="secondary-button" disabled={!editable} onClick={onSave}>{quarterLabel(quarter, draft.matchFormat)} 기록 저장</button>
      <p className="field-help">현재 경기의 다른 변경도 함께 저장해요. 완료 처리 없이 이 화면에서 이어서 입력할 수 있어요.</p></div>}
  </section>
}
