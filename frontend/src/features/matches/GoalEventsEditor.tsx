import { useEffect, useState } from 'react'
import type { GoalEvent, MatchFormat, MatchTeam, Participant, Quarter } from './api'
import { playerLabel } from './api'
import { conversionMismatch, goalTypeLabels, seedGoalEvents, withGoalEvents } from './goalEvents'
import { quarterLabel } from './matchFormat'
import './goal-events.css'

export function GoalEventsEditor({ quarter, participants, team, internal, editable, matchFormat, onChange }: {
  quarter: Quarter; participants: Participant[]; team: MatchTeam; internal: boolean; editable: boolean
  matchFormat?: MatchFormat | null; onChange: (quarter: Quarter) => void
}) {
  const [conversion, setConversion] = useState<GoalEvent[] | null>(null)
  const [scorer, setScorer] = useState('')
  const [assist, setAssist] = useState('')
  const [type, setType] = useState<GoalEvent['type']>('NORMAL')
  const [error, setError] = useState('')
  useEffect(() => { setScorer(''); setAssist(''); setType('NORMAL'); setError('') }, [team])
  const linked = Array.isArray(quarter.goalEvents)
  const events = conversion ?? quarter.goalEvents ?? []
  const label = (id: number) => { const p = participants.find(p => p.playerId === id); return p ? playerLabel(p) : '명단 확인 필요' }
  const candidates = (side: MatchTeam) => quarter.lineup.filter(a => a.team === side).sort((a, b) => (participants.find(p => p.playerId === a.playerId)?.shirtNumber ?? 100) - (participants.find(p => p.playerId === b.playerId)?.shirtNumber ?? 100))
  const hasLegacyStats = quarter.lineup.some(a => a.goals || a.assists)
  const mismatch = conversion === null ? null : conversionMismatch(quarter, conversion)
  function save(next: GoalEvent[]) {
    if (!editable) return
    try { onChange(withGoalEvents(quarter, next)); setError('') } catch (cause) { setError((cause as Error).message) }
  }
  function edit(index: number, patch: Partial<GoalEvent>) {
    const next = events.map((event, i) => i === index ? { ...event, ...patch } : event)
    if (conversion) setConversion(next)
    else save(next)
  }
  function add() {
    if (!scorer) { setError('득점자를 선택해 주세요.'); return }
    const event: GoalEvent = { team, scorerId: Number(scorer), assistId: assist ? Number(assist) : null, type }
    try { const next = withGoalEvents(quarter, [...events, event]); onChange(next); setScorer(''); setAssist(''); setError('') }
    catch (cause) { setError((cause as Error).message) }
  }
  return <section className="goal-events" aria-labelledby={`goal-events-${quarter.number}`}>
    <h4 id={`goal-events-${quarter.number}`}>{quarterLabel(quarter.number, matchFormat)} · 골별 기록</h4>
    <p className="field-help">골마다 득점자와 도움 선수를 연결해요. 선수 기록은 자동 합산되며, 시즌 통계에는 경기 완료 후 반영돼요.</p>
    {!linked && conversion === null && hasLegacyStats ? <div className="goal-event-legacy">
      <p>기존 골·도움 합계를 보관 중이에요. 득점과 도움의 연결은 아직 기록되지 않았어요.</p>
      {editable && <button type="button" className="secondary-button" onClick={() => { setConversion(seedGoalEvents(quarter)); setError('') }}>기존 득점에 도움 선수 연결</button>}
    </div> : <>
      {conversion !== null && <p className="save-notice">기존 득점자는 그대로 두고 도움 선수를 연결해 주세요. A·B팀이 있으면 두 팀 모두 확인해요. 전환 완료 전에는 기존 기록이 바뀌지 않아요.</p>}
      {events.length === 0 && <p className="field-help">아직 골별 기록이 없어요.</p>}
      <ol className="goal-event-list">{events.map((event, index) => <li key={index}>
        <div className="goal-event-heading"><strong>{internal ? `${event.team}팀 · ` : ''}{index + 1}번째 골</strong><span>{goalTypeLabels[event.type]}</span>
          {editable && conversion === null && <button type="button" className="text-button" aria-label={`${index + 1}번째 골 삭제`} onClick={() => save(events.filter((_, i) => i !== index))}>삭제</button>}</div>
        {editable ? <div className="goal-event-fields">
          <label>득점자<select value={event.scorerId} disabled={conversion !== null} onChange={e => edit(index, { scorerId: Number(e.target.value), assistId: Number(e.target.value) === event.assistId ? null : event.assistId })}>{candidates(event.team).map(a => <option key={a.playerId} value={a.playerId}>{label(a.playerId)}</option>)}</select></label>
          <label>도움<select value={event.assistId ?? ''} disabled={event.type !== 'NORMAL'} onChange={e => edit(index, { assistId: e.target.value ? Number(e.target.value) : null })}><option value="">없음 / 미확인</option>{candidates(event.team).filter(a => a.playerId !== event.scorerId).map(a => <option key={a.playerId} value={a.playerId}>{label(a.playerId)}</option>)}</select></label>
          {conversion === null && <label>골 유형<select value={event.type} onChange={e => edit(index, { type: e.target.value as GoalEvent['type'], assistId: e.target.value === 'NORMAL' ? event.assistId : null })}>{Object.entries(goalTypeLabels).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>}
        </div> : <p><strong>{label(event.scorerId)} 골</strong> · {event.assistId == null ? '도움 없음 / 미확인' : `${label(event.assistId)} 도움`}</p>}
      </li>)}</ol>
      {editable && conversion !== null ? <div className="goal-event-convert"><p className="field-help">{mismatch ?? '기존 골·도움 합계와 일치해요. 골별 기록으로 전환할 수 있어요.'}</p><button type="button" className="secondary-button" onClick={() => setConversion(null)}>전환 취소</button><button type="button" className="primary-button" disabled={!!mismatch} onClick={() => { save(conversion); setConversion(null) }}>연결 완료 · 골별 기록 사용</button></div>
        : editable && <details className="goal-add-disclosure" key={team}><summary>{internal ? `${team}팀 ` : ''}골 추가</summary><fieldset className="goal-event-add"><legend className="sr-only">{internal ? `${team}팀 ` : ''}골 추가</legend>
          <div className="goal-event-fields"><label>득점자<select value={scorer} onChange={e => { setScorer(e.target.value); if (e.target.value === assist) setAssist('') }}><option value="">선수 선택</option>{candidates(team).map(a => <option key={a.playerId} value={a.playerId}>{label(a.playerId)}</option>)}</select></label>
            <label>도움<select value={assist} disabled={type !== 'NORMAL'} onChange={e => setAssist(e.target.value)}><option value="">없음 / 미확인</option>{candidates(team).filter(a => a.playerId !== Number(scorer)).map(a => <option key={a.playerId} value={a.playerId}>{label(a.playerId)}</option>)}</select></label>
            <label>골 유형<select value={type} onChange={e => { setType(e.target.value as GoalEvent['type']); if (e.target.value !== 'NORMAL') setAssist('') }}>{Object.entries(goalTypeLabels).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label></div>
          <button type="button" className="primary-button" disabled={!candidates(team).length} onClick={add}>골 추가</button>
        </fieldset></details>}
    </>}
    <p className="field-help">직접 프리킥·페널티킥 골에는 도움을 입력하지 않아요. 상대 자책골은 선수 득점에 넣지 않고 최종 스코어에 반영해 주세요.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>
}
