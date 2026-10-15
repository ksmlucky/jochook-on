import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { canPlay, playerLabel, quarterShare, slotLabels } from './api'
import type { Appearance, MatchTeam, Participant, Quarter, Slot } from './api'
import { ageBand } from '../players/age'
import { slotGroup } from './formations'

const mobileQuery = '(max-width: 700px)'
function subscribeMobile(callback: () => void) {
  const query = window.matchMedia(mobileQuery)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}
const isMobile = () => window.matchMedia(mobileQuery).matches

function PositionDialog({ title, isAdmin, onClose, children }: { title: string; isAdmin: boolean; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  const close = () => { dialog.current?.close(); onClose() }
  return createPortal(<dialog ref={dialog} className="lineup-position-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close() }}>
    <div className="lineup-dialog-heading"><h3 id={titleId}>{title}</h3><button type="button" className="secondary-button" onClick={close}>닫기</button></div>
    {children}
    {isAdmin && <p className="field-help">입력 완료는 창을 닫는 동작입니다. 변경한 내용은 단계별 저장 또는 ‘중간 저장 · 목록으로’를 눌러 저장하세요.</p>}
    <button type="button" className="primary-button lineup-dialog-done" onClick={close}>{isAdmin ? '입력 완료' : '확인'}</button>
  </dialog>, document.body)
}

export function LineupPosition({ slot, quarter, participants, referenceYear, isAdmin, editable, onChange, team, internal }: {
  slot: Slot; quarter: Quarter; participants: Participant[]; referenceYear: number; isAdmin: boolean; editable: boolean
  onChange: (slot: Slot, order: 0 | 1, patch: Partial<Appearance> | null) => void
  team: MatchTeam; internal: boolean
}) {
  const [addingSubstitute, setAddingSubstitute] = useState(false)
  const compact = useSyncExternalStore(subscribeMobile, isMobile, () => false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const starter = quarter.lineup.find(a => a.team === team && a.slot === slot && a.entryOrder === 0)
  const group = slotGroup(slot)
  const entries = () => ([0, 1] as const).map(order => {
    const a = quarter.lineup.find(a => a.team === team && a.slot === slot && a.entryOrder === order)
    const selected = participants.find(p => p.playerId === a?.playerId)
    if (order === 1 && !a) {
      if (!isAdmin || !starter) return null
      if (!addingSubstitute) return <button type="button" key={order} className="lineup-add-substitute" disabled={!editable}
        aria-label={`${quarter.number}쿼터 ${slotLabels[slot]} 교체 선수 추가`} onClick={() => setAddingSubstitute(true)}>+ 교체 선수 추가</button>
    }
    const label = `${quarter.number}쿼터 ${internal ? `${team}팀 ` : ''}${slotLabels[slot]} ${order === 0 ? '선발' : a ? '교체' : '투입'}`
    return <div className="lineup-entry" key={order}>
      <label htmlFor={`lineup-${slot}-${order}`}>{order === 0 ? '선발' : a ? '↳ 교체 투입' : '투입 선수 선택'}{a ? ` · ${quarterShare(quarter, a)}쿼터` : ''}</label>
      {isAdmin ? <select id={`lineup-${slot}-${order}`} aria-label={`${label} 선수`} disabled={!editable || (order === 1 && !starter)} value={a?.playerId ?? ''}
        onChange={e => { onChange(slot, order, e.target.value ? { playerId: Number(e.target.value) } : null); setAddingSubstitute(false) }}>
        <option value="">{order === 0 ? '미기록' : a ? '선택 해제' : '선수 선택'}</option>
        {selected && !canPlay(selected) && <option value={selected.playerId}>{playerLabel(selected)} · 출석 확인 필요</option>}
        {participants.filter(canPlay).map(p => <option key={p.playerId} value={p.playerId} disabled={quarter.lineup.some(a => a.playerId === p.playerId && (a.team !== team || a.slot !== slot || a.entryOrder !== order))}>{playerLabel(p)}{quarter.lineup.some(a => a.playerId === p.playerId && a.team !== team) ? ' · 다른 팀 배치' : ''}</option>)}
      </select> : <strong>{selected ? playerLabel(selected) : '미기록'}</strong>}
      {selected && <small className="lineup-age">{ageBand(selected.birthYear, referenceYear)}{selected.birthYear !== null ? ` · ${selected.birthYear}년생` : ''}</small>}
      {(order === 0 || a) && <div className="lineup-stats"><label>골<input aria-label={`${label} 득점`} type="number" min={0} max={99} required disabled={!editable || !a} value={a?.goals ?? 0} onChange={e => onChange(slot, order, { goals: Number(e.target.value) })} /></label>
        <label>도움<input aria-label={`${label} 도움`} type="number" min={0} max={99} required disabled={!editable || !a} value={a?.assists ?? 0} onChange={e => onChange(slot, order, { assists: Number(e.target.value) })} /></label></div>}
      {order === 1 && !a && <button type="button" className="lineup-add-substitute" disabled={!editable} onClick={() => setAddingSubstitute(false)}>추가 취소</button>}
    </div>
  })
  const positionTitle = `${quarter.number}쿼터 ${internal ? `${team}팀 ` : ''}${slotLabels[slot]}`
  return <div className={`lineup-player position-${group}${compact ? ' is-compact' : ''}`} data-position={slot}>
    {compact ? <>
      <button type="button" className="lineup-summary" aria-label={`${positionTitle} ${isAdmin ? '선수·기록 입력' : '출전 기록 보기'}`} aria-haspopup="dialog" onClick={() => setDetailsOpen(true)}>
        <strong className="lineup-position-label position-badge">{slotLabels[slot]}</strong>
        {([0, 1] as const).map(order => {
          const entry = quarter.lineup.find(a => a.team === team && a.slot === slot && a.entryOrder === order)
          const person = participants.find(p => p.playerId === entry?.playerId)
          if (order === 1 && !entry) return null
          return <span key={order} className={`lineup-summary-person${order === 1 ? ' is-substitute' : ''}`}>
            {order === 1 && <small>↳ 교체</small>}
            <strong>{person ? playerLabel(person) : isAdmin ? '+ 선수 선택' : '미기록'}</strong>
            {entry && <small className="lineup-summary-stats"><span>{quarterShare(quarter, entry)}Q</span><span>골{entry.goals} · 도움{entry.assists}</span></small>}
          </span>
        })}
      </button>
      {detailsOpen && <PositionDialog title={positionTitle} isAdmin={isAdmin} onClose={() => setDetailsOpen(false)}><div className={`lineup-dialog-fields position-${group}`}>{entries()}</div></PositionDialog>}
    </> : <><strong className="lineup-position-label position-badge">{slotLabels[slot]}</strong>{entries()}</>}
  </div>
}
