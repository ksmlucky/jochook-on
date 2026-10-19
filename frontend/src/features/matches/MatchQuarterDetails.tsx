import { useEffect, useId, useState } from 'react'
import { SessionExpiredError } from '../auth/api'
import { fetchMatch } from './api'
import type { MatchRecord } from './api'
import { quarterHighlights } from './quarterHighlights'
import './match-quarter-details.css'

export function MatchQuarterDetails({ id, disabled, onSessionExpired }: { id: number; disabled: boolean; onSessionExpired: () => void }) {
  const [open, setOpen] = useState(false)
  const [record, setRecord] = useState<MatchRecord | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const panelId = useId()
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setRecord(null); setError('')
    fetchMatch(id, controller.signal).then(value => {
      if (!controller.signal.aborted) setRecord(value)
    }).catch(cause => {
      if (controller.signal.aborted) return
      setError('상세 기록을 불러오지 못했어요. 다시 시도해 주세요.')
      if (cause instanceof SessionExpiredError) onSessionExpired()
    })
    return () => controller.abort()
  }, [id, open, attempt, onSessionExpired])
  return <div className="match-quarter-details">
    <button type="button" className="text-button" aria-expanded={open} aria-controls={panelId} disabled={disabled} onClick={() => setOpen(value => !value)}>{open ? '쿼터별 기록 접기 ▴' : '쿼터별 기록 펼치기 ▾'}</button>
    <div id={panelId} hidden={!open}>
      {error ? <p role="alert">{error} <button type="button" className="text-button" onClick={() => setAttempt(a => a + 1)}>다시 불러오기</button></p>
        : !record ? <p role="status">기록을 불러오고 있어요.</p>
          : <ol className="match-quarter-highlights">{quarterHighlights(record).map(q => <li key={q.number}>
            <h4>{q.label}</h4>{q.teams.map(side => <div key={side.team}>
              {record.kind === 'INTERNAL' && <strong>{side.team}팀</strong>}
              {side.lines.length ? <ul>{side.lines.map((line, index) => <li key={index}>{line}</li>)}</ul> : <p className="field-help">등록된 득점·도움 없음</p>}
              {side.unlinked && <small>선수별 합계 · 골과 도움의 연결 미기록</small>}
              {side.conceded != null && side.conceded > 0 && <p className="quarter-conceded-summary">실점 {side.conceded}골</p>}
            </div>)}
          </li>)}</ol>}
    </div>
  </div>
}
