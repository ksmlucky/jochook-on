import { useState } from 'react'
import type { Participant, Quarter } from './api'
import { playerLabel } from './api'
import { withGoalEvents } from './goalEvents'
import { moveScoringEvent, scoringOrderCandidates, validScoringOrder } from './scoringOrder'
import './scoring-order.css'

export function ScoringOrderEditor({ quarter, participants, internal, editable, onChange }: {
  quarter: Quarter; participants: Participant[]; internal: boolean; editable: boolean; onChange: (quarter: Quarter) => void
}) {
  const known = validScoringOrder(quarter, internal)
  const hasLegacyTotals = !Array.isArray(quarter.goalEvents) && quarter.lineup.some(a => a.goals || a.assists)
  const source = Array.isArray(quarter.goalEvents) ? quarter : { ...quarter, goalEvents: [] }
  const canArrange = !hasLegacyTotals && (internal || Number.isInteger(quarter.goalsAgainst) && quarter.goalsAgainst != null && quarter.goalsAgainst >= 0 && quarter.goalsAgainst <= 99)
  const [order, setOrder] = useState(() => known ? [...quarter.scoringOrder!] : scoringOrderCandidates(source, internal))
  const [error, setError] = useState('')
  function label(index: number) {
    if (index === -1) return '상대 팀 득점 · 우리 팀 실점'
    const goal = source.goalEvents![index]
    const scorer = participants.find(p => p.playerId === goal?.scorerId)
    const helper = participants.find(p => p.playerId === goal?.assistId)
    return `${internal ? `${goal?.team}팀 · ` : ''}${scorer ? playerLabel(scorer) : '선수 확인 필요'} 골${helper ? ` · ${playerLabel(helper)} 도움` : ''}`
  }
  function confirm() {
    if (!editable || !canArrange) return
    try {
      const next = { ...withGoalEvents(quarter, source.goalEvents!), scoringOrder: order, scoringOrderSpecified: true }
      if (!validScoringOrder(next, internal)) { setError('득점·실점 수와 순서를 다시 확인해 주세요.'); return }
      onChange(next)
    } catch (cause) { setError((cause as Error).message) }
  }
  return <details className="scoring-order-editor">
    <summary>득실점 순서 정하기 <span>{known ? '순서 확인됨' : '순서 미확인'}</span></summary>
    <p className="field-help">{known ? '위에서 아래로 실제 골이 들어간 순서예요.' : '아래 목록은 제안 순서예요. 실제 순서로 옮긴 뒤 확인해 주세요.'} 경기 시간은 입력하지 않아요.</p>
    {hasLegacyTotals ? <p className="field-help">먼저 위에서 기존 득점에 도움 선수를 연결해 주세요.</p>
      : !canArrange ? <p className="field-help">위에서 이 구간의 실점을 입력해 주세요. 무실점이면 0을 입력해요.</p>
        : <><ol className="scoring-order-list">{order.map((index, position) => <li key={position}>
          <span className="scoring-order-label">{position + 1}. {label(index)}</span>
          {editable && <span className="scoring-order-buttons">
            <button type="button" className="secondary-button" aria-label={`${position + 1}번째 기록 위로`} disabled={position === 0} onClick={() => setOrder(moveScoringEvent(order, position, -1))}>↑</button>
            <button type="button" className="secondary-button" aria-label={`${position + 1}번째 기록 아래로`} disabled={position === order.length - 1} onClick={() => setOrder(moveScoringEvent(order, position, 1))}>↓</button>
          </span>}
        </li>)}</ol>{order.length === 0 && <p className="field-help">이 구간은 득점·실점이 없어요.</p>}
          {editable && <button type="button" className="secondary-button" onClick={confirm}>이 순서로 확인</button>}</>}
    {editable && known && <button type="button" className="text-button" onClick={() => onChange({ ...quarter, scoringOrder: null, scoringOrderSpecified: true })}>순서 미확인으로 변경</button>}
    <p className="field-help">순서를 확인한 뒤 구간 기록을 저장해 주세요. 골·도움·실점을 바꾸면 순서를 다시 확인해요.</p>
    {error && <p role="alert" className="form-error">{error}</p>}
  </details>
}
