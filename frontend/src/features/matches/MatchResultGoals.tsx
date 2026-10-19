import { updateQuarterResult, quarterGoals } from './quarterScores'
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
    const q = draft.quarters.find(q => q.number === number)!
    onChange(updateQuarterResult(draft, { ...q, lineup: q.lineup.map(a => a.playerId === playerId ? { ...a, ...patch } : a) }))
  }
  return <section aria-label="쿼터별 득점 입력">
    <div className="quarter-tabs" role="group" aria-label="골 기록 쿼터 선택">{quarterNumbers(draft.matchFormat).map(n => <button type="button" key={n} aria-pressed={quarter === n} onClick={() => setQuarter(n)}>{quarterLabel(n, draft.matchFormat)}</button>)}</div>
    {internal && <TeamSelector team={team} onChange={setTeam} disabled={!editable && isAdmin} label="골 입력 팀" counts={{ A: current.lineup.filter(a => a.team === 'A').length, B: current.lineup.filter(a => a.team === 'B').length }} />}
    {draft.quarters.map(q => <div key={`${draft.kind}-${draft.matchFormat}-${q.number}`} hidden={q.number !== quarter}>
      <GoalEventsEditor quarter={q} participants={draft.participants} team={team} internal={internal} editable={editable} matchFormat={draft.matchFormat}
        onChange={next => onChange(updateQuarterResult(draft, next))} />
      <div className="quarter-score-entry">
        <strong>{quarterLabel(q.number, draft.matchFormat)} {internal ? `${team}팀` : '우리 팀'} 득점 · {quarterGoals(q, internal ? team : 'A')}골</strong>
        {internal ? <p>{team}팀 실점 · {quarterGoals(q, team === 'A' ? 'B' : 'A')}골 <small>상대 팀 득점에서 자동 반영</small></p>
          : <div className="quarter-conceded-control"><label htmlFor={`conceded-${q.number}`}>{quarterLabel(q.number, draft.matchFormat)} 실점</label><div className="quarter-conceded-stepper">
            <button type="button" className="secondary-button" aria-label={`${quarterLabel(q.number, draft.matchFormat)} 실점 줄이기`} disabled={!editable || !(q.goalsAgainst != null && q.goalsAgainst > 0)}
              onClick={() => onChange(updateQuarterResult(draft, { ...q, goalsAgainst: Math.max(0, (q.goalsAgainst ?? 0) - 1), goalsAgainstSpecified: true }))}>−</button>
            <input id={`conceded-${q.number}`} type="number" inputMode="numeric" min={0} max={99} step={1} disabled={!editable} value={q.goalsAgainst ?? ''} placeholder="미입력"
              onChange={event => onChange(updateQuarterResult(draft, { ...q, goalsAgainst: event.target.value === '' ? null : event.target.valueAsNumber, goalsAgainstSpecified: true }))} />
            <button type="button" className="secondary-button" aria-label={`${quarterLabel(q.number, draft.matchFormat)} 실점 늘리기`} disabled={!editable || (q.goalsAgainst != null && (!Number.isFinite(q.goalsAgainst) || q.goalsAgainst >= 99))}
              onClick={() => onChange(updateQuarterResult(draft, { ...q, goalsAgainst: Math.min(99, Math.max(0, Math.floor(q.goalsAgainst ?? 0)) + 1), goalsAgainstSpecified: true }))}>+</button>
          </div></div>}
      </div>
      {isAdmin && !Array.isArray(q.goalEvents) && q.lineup.some(a => a.goals || a.assists) && <details className="legacy-goal-edit"><summary>기존 선수별 골·도움 수정</summary>
        <p className="field-help">예전 합계 기록을 정정할 때 사용해요. 골별 기록으로 연결한 뒤에는 위에서 수정해 주세요.</p>
        {q.lineup.filter(a => a.team === team).map(a => { const player = draft.participants.find(p => p.playerId === a.playerId); const name = player ? playerLabel(player) : '선수 확인 필요'; return <fieldset key={a.playerId} disabled={!editable}><legend>{name}</legend><div className="goal-event-fields">
          <label>총 골<input aria-label={`${name} 총 골`} type="number" min={0} max={99} step={1} value={a.goals} onChange={e => editLegacy(q.number, a.playerId, { goals: e.target.valueAsNumber })} /></label>
          <label>도움<input aria-label={`${name} 도움`} type="number" min={0} max={99} step={1} value={a.assists} onChange={e => editLegacy(q.number, a.playerId, { assists: e.target.valueAsNumber })} /></label></div>
          <GoalBreakdownFields entry={a} label={name} editable={editable} onChange={patch => editLegacy(q.number, a.playerId, patch)} /></fieldset> })}
      </details>}
    </div>)}
    <p className="field-help">골·실점을 바꾸면 최종 스코어도 반영돼요.{!internal && ` 실점 미입력 ${draft.quarters.filter(q => q.goalsAgainst == null).length}구간은 합산에서 제외해요. 무실점이면 0을 입력해 주세요.`}</p>
    {isAdmin && <div className="quarter-record-save"><button type="button" className="secondary-button" disabled={!editable} onClick={onSave}>{quarterLabel(quarter, draft.matchFormat)} 기록 저장</button>
      <p className="field-help">현재 경기의 다른 변경도 함께 저장해요. 완료 처리 없이 이 화면에서 이어서 입력할 수 있어요.</p></div>}
  </section>
}
