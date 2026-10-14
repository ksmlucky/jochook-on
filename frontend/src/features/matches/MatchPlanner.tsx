import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Player } from '../players/api'
import { preferredPositionGroup } from '../players/api'
import { ageBand } from '../players/age'
import { pitchRows, playerLabel, slotLabels } from './api'
import type { MatchTeam, Participant, PlannedEntry, Slot } from './api'
import { TeamSelector } from './TeamSelector'
import { PitchMarkings } from './PitchMarkings'
import { checkPlan, placeInPlan, plannedShare } from './plan'

export function MatchPlanner({ entries, participants, players, editable, referenceYear, onChange, tools, footer, internal = false }: {
  entries: PlannedEntry[]; participants: Participant[]; players: Player[]; editable: boolean; referenceYear: number
  onChange: (entries: PlannedEntry[]) => void; tools?: ReactNode; footer: ReactNode; internal?: boolean
}) {
  const [quarter, setQuarter] = useState(1)
  const [team, setTeam] = useState<MatchTeam>('A')
  const [selected, setSelected] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [confirmCopy, setConfirmCopy] = useState(false)
  const [dragPreview, setDragPreview] = useState<{ playerId: number; x: number; y: number } | null>(null)
  const [hoveredPlace, setHoveredPlace] = useState<string | null>(null)
  const drag = useRef<{ playerId: number; x: number; y: number; moved: boolean } | null>(null)
  const skipClick = useRef(false)
  const candidates = participants.filter(p => p.vote === 'ATTENDING').sort((a, b) => (a.shirtNumber ?? 100) - (b.shirtNumber ?? 100) || a.playerId - b.playerId)
  const allQuarter = entries.filter(a => a.quarterNumber === quarter)
  const q = allQuarter.filter(a => a.team === team)
  const draggedPlayer = candidates.find(p => p.playerId === dragPreview?.playerId)
  const draggedProfile = players.find(p => p.id === dragPreview?.playerId)
  function canPlace(slot: Slot, order: 0 | 1) {
    if (selected === null) return order === 0 || q.some(a => a.slot === slot && a.entryOrder === 0)
    try { placeInPlan(entries, quarter, slot, order, selected, team); return true } catch { return false }
  }
  function place(slot: Slot, order: 0 | 1, id: number | null) {
    if (!editable || id === null || !candidates.some(p => p.playerId === id)) return
    try { onChange(placeInPlan(entries, quarter, slot, order, id, team)); setSelected(null); setMessage(`${quarter}쿼터 ${internal ? `${team}팀 ` : ''}${slotLabels[slot]} ${order === 0 ? '선발' : '교체'} 배치를 변경했습니다.`) }
    catch (e) { setMessage((e as Error).message) }
  }
  function remove(entry: PlannedEntry) {
    const next = entries.filter(a => a !== entry)
    try { checkPlan(next); onChange(next); setSelected(null); setMessage('배치를 해제했습니다.') } catch (e) { setMessage((e as Error).message) }
  }
  function copyPrevious(confirmed = false) {
    if (allQuarter.length && !confirmed) { setConfirmCopy(true); return }
    onChange([...entries.filter(a => a.quarterNumber !== quarter), ...entries.filter(a => a.quarterNumber === quarter - 1).map(a => ({ ...a, quarterNumber: quarter }))])
    setSelected(null); setConfirmCopy(false); setMessage('이전 쿼터의 계획을 복사했습니다.')
  }
  return <section className="match-block" aria-labelledby="plan-title">
    <div className="match-block-title"><h4 id="plan-title" tabIndex={-1}>02 · 경기 전 스쿼드 계획</h4><span>4-1-2-3 · 참석 예정자 직접 배치</span></div>
    <p className="field-help">선수를 끌어서 놓거나, 선수를 선택한 뒤 자리를 클릭하세요. 이미 배치한 선수도 옮길 수 있고 두 선수가 있는 자리는 서로 교환합니다. 계획은 실제 출전·득점 집계에 포함되지 않습니다.</p>
    {tools}
    <div className="quarter-tabs" role="group" aria-label="계획 쿼터 선택">{[1, 2, 3, 4].map(n => <button type="button" key={n} aria-pressed={quarter === n} onClick={() => { setQuarter(n); setSelected(null); setMessage(''); setConfirmCopy(false) }}>{n}쿼터 <small>{internal ? `${team}팀 ` : ''}선발 {entries.filter(a => a.quarterNumber === n && a.team === team && a.entryOrder === 0).length}/11</small></button>)}</div>
    {internal && <><TeamSelector team={team} disabled={false} label="계획 편성 팀" counts={{ A: allQuarter.filter(a => a.team === 'A').length, B: allQuarter.filter(a => a.team === 'B').length }} onChange={value => { setTeam(value); setSelected(null); setMessage(''); setConfirmCopy(false) }} />
      <p className="field-help">양 팀을 직접 배치합니다. 다른 팀에 배치된 선수는 해당 팀에서 먼저 해제하세요. 다른 쿼터에서는 팀을 바꿀 수 있습니다.</p></>}
    <div className="planner-layout"><aside className="planner-bench" aria-label="계획 배치 선수">
      <h5>참석 예정 선수 · {candidates.length}명</h5><p className="field-help">각 선수 아래는 4쿼터 합계 계획입니다.</p>
      {!candidates.length && <p>위에서 참석 예정 선수를 먼저 선택해 주세요.</p>}
      {candidates.map(p => { const profile = players.find(player => player.id === p.playerId); const share = entries.filter(a => a.playerId === p.playerId).reduce((sum, a) => sum + plannedShare(entries, a), 0)
        const assigned = allQuarter.find(a => a.playerId === p.playerId)
        const preferences = [profile?.firstChoice, profile?.secondChoice, profile?.thirdChoice].filter(Boolean)
        return <button key={p.playerId} type="button" className={`planner-candidate position-${preferredPositionGroup(profile?.firstChoice ?? null)}${assigned ? ' is-assigned' : ''}${dragPreview?.playerId === p.playerId ? ' is-dragging' : ''}`} disabled={!editable || (!!assigned && assigned.team !== team)} aria-pressed={selected === p.playerId}
          onClick={() => { if (skipClick.current) { skipClick.current = false; return } setSelected(selected === p.playerId ? null : p.playerId); setMessage('배치할 자리를 선택하세요.') }}
          onPointerDown={e => { if (!editable || e.button !== 0) return; skipClick.current = false; drag.current = { playerId: p.playerId, x: e.clientX, y: e.clientY, moved: false }; e.currentTarget.setPointerCapture(e.pointerId) }}
          onPointerMove={e => {
            const current = drag.current; if (!current) return
            if (!current.moved && Math.hypot(e.clientX - current.x, e.clientY - current.y) <= 6) return
            current.moved = true; setSelected(current.playerId)
            setDragPreview({ playerId: current.playerId, x: Math.max(8, Math.min(e.clientX + 16, window.innerWidth - 238)), y: Math.max(8, Math.min(e.clientY + 16, window.innerHeight - 116)) })
            const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLButtonElement>('[data-plan-slot]')
            setHoveredPlace(target && !target.disabled ? `${target.dataset.planSlot}:${target.dataset.planOrder}` : null)
          }}
          onPointerCancel={() => { drag.current = null; skipClick.current = false; setDragPreview(null); setHoveredPlace(null); setSelected(null) }}
          onLostPointerCapture={() => { drag.current = null; setDragPreview(null); setHoveredPlace(null) }}
          onPointerUp={e => {
            const current = drag.current; drag.current = null; setDragPreview(null); setHoveredPlace(null)
            if (!current?.moved) return
            skipClick.current = true
            const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLButtonElement>('[data-plan-slot]')
            if (target && !target.disabled) place(target.dataset.planSlot as Slot, Number(target.dataset.planOrder) as 0 | 1, current.playerId)
            else setMessage('선발 또는 교체 자리에 놓아 주세요. 클릭으로 배치해도 됩니다.')
          }}>
          <strong className="planner-player-name"><span className="planner-player-number">{p.playerType === 'GUEST' ? '용병 · ' : ''}{p.shirtNumber === null ? '등번호 없음' : `#${p.shirtNumber}`}</span>{' '}<span>{p.name}</span></strong><small className="planner-preferences"><span className="planner-preference-list">{preferences.length ? preferences.map((position, index) => <span key={position}>{index > 0 ? '/' : ''}{position}</span>) : '미확인'}</span><span className="planner-age">{ageBand(p.birthYear, referenceYear)}</span></small>
          <span className={`planner-assignment${assigned ? ' is-assigned' : ''}`}>{assigned ? `✓ ${internal ? `${assigned.team}팀 ` : ''}${slotLabels[assigned.slot]} ${assigned.entryOrder === 0 ? '선발' : '교체'}` : '이번 쿼터 휴식'}</span>
          <small>총 {share}쿼터</small>
        </button>
      })}
    </aside><div><div className={`lineup-pitch plan-pitch tactics-pitch${internal ? ` team-pitch-${team.toLowerCase()}` : ''}`} aria-label={`${quarter}쿼터 ${internal ? `${team}팀 ` : ''}계획 4-1-2-3`}><PitchMarkings /><p className="attack-direction">{internal && `${team}팀 · `}공격 방향 ↑</p>
      {pitchRows.map((row, i) => <div className="lineup-row" key={i}>{row.map(slot => {
        const group = slot === 'GK' ? 'GK' : ['LB', 'LCB', 'RCB', 'RB'].includes(slot) ? 'DF' : ['CDM', 'LCM', 'RCM'].includes(slot) ? 'MF' : 'FW'
        return <div className={`plan-position position-${group}`} data-position={slot} key={slot}><span className="position-badge">{slotLabels[slot]}</span>{([0, 1] as const).map(order => {
          const entry = q.find(a => a.slot === slot && a.entryOrder === order); const person = candidates.find(p => p.playerId === entry?.playerId)
          const emptySubstitute = order === 1 && !entry
          if (emptySubstitute && (!editable || !q.some(a => a.slot === slot && a.entryOrder === 0))) return null
          const validTarget = canPlace(slot, order)
          return <div className={`plan-place${order === 1 ? ' is-substitute' : ''}${emptySubstitute ? ' is-empty-substitute' : ''}`} key={order}><button type="button" className={`${entry ? 'plan-filled ' : ''}${selected !== null && validTarget ? 'plan-drop-ready ' : ''}${hoveredPlace === `${slot}:${order}` ? 'plan-drop-hover' : ''}`} disabled={!editable || !validTarget}
            data-plan-slot={slot} data-plan-order={order}
            aria-label={`${quarter}쿼터 계획 ${slotLabels[slot]} ${order === 0 ? '선발' : '교체'} 자리`}
            title={emptySubstitute ? '후보 선수를 선택한 뒤 누르거나 이곳으로 끌어 놓으세요.' : undefined}
            onClick={() => {
              if (emptySubstitute && selected === null) { setMessage('참석 예정 선수에서 교체할 선수를 먼저 선택한 뒤, 이 자리의 + 교체를 눌러 주세요.'); return }
              place(slot, order, selected)
            }}>
            {emptySubstitute ? <span>+ 교체</span> : <><small>{entry ? '✓ ' : ''}{order === 0 ? '선발' : '교체'}{entry ? ` · ${plannedShare(entries, entry)}Q` : ''}</small><strong>{person ? playerLabel(person) : '+ 배치'}</strong></>}
          </button>{entry && editable && <button type="button" className="plan-remove" aria-label={`${quarter}쿼터 ${slotLabels[slot]} ${order === 0 ? '선발' : '교체'} 배치 해제`} onClick={() => remove(entry)}>×</button>}</div>
        })}</div>
      })}</div>)}
    </div><div className="import-tools">{editable && quarter > 1 && <button type="button" className="secondary-button" onClick={() => copyPrevious()}>{internal ? '이전 쿼터 양 팀 계획 복사' : '이전 쿼터 계획 복사'}</button>}
      </div>
    <p className="field-help">아래 ‘계획 저장 · 실제 기록으로’로 저장하고 03에서 계획대로 참석·출전 기록을 저장할 수 있습니다.</p></div></div>
    {confirmCopy && <div className="conflict-notice" role="alert"><p>현재 {quarter}쿼터 {internal ? '양 팀 ' : ''}계획을 이전 쿼터 계획으로 교체할까요?</p><button type="button" className="secondary-button" onClick={() => copyPrevious(true)}>현재 계획 교체</button> <button type="button" className="secondary-button" onClick={() => setConfirmCopy(false)}>복사 취소</button></div>}
    {message && <p role="status" className="planner-message">{message}</p>}
    {footer}
    {dragPreview && draggedPlayer && createPortal(<div className={`planner-drag-card position-${preferredPositionGroup(draggedProfile?.firstChoice ?? null)}`} style={{ left: dragPreview.x, top: dragPreview.y }} aria-hidden="true">
      <strong>{playerLabel(draggedPlayer)}</strong><small>{draggedProfile?.firstChoice ?? '미확인'} · {quarter}쿼터 배치</small><span>{hoveredPlace ? '여기에 놓기' : '강조된 자리에 놓으세요'}</span>
    </div>, document.body)}
  </section>
}
