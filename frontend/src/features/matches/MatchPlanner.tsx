import { usePitchDrag, PitchDragPreview } from './usePitchDrag'
import { FadeToast } from '../../app/FadeToast'
import { useTimedNotice } from '../../app/useTimedNotice'
import { OverviewPositionEditor } from './OverviewPositionEditor'
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Player } from '../players/api'
import { preferredPositionGroup } from '../players/api'
import { ageBand } from '../players/age'
import { playerLabel, slotLabels } from './api'
import type { Appearance, MatchTeam, Participant, PlannedEntry, Quarter, Slot } from './api'
import { TeamSelector } from './TeamSelector'
import { PitchMarkings } from './PitchMarkings'
import { checkPlan, placeInPlan, plannedShare, removeFromPlan } from './plan'
import { formationFor, formationLabel, pitchRowsFor, slotGroup } from './formations'
import type { Formation } from './formations'
import { SquadOverview } from './SquadOverview'
import { unassignedAttendees } from './internalTeams'
import { matchPeriodSummary, quarterLabel, quarterNumbers } from './matchFormat'
import type { MatchFormat } from './matchFormat'

export function MatchPlanner({ entries, participants, players, editable, referenceYear, onChange, tools, footer, shareControl, internal = false, formationA, formationB, matchFormat, quarters, onRecordEdit, quarter, team, setQuarter, setTeam }: {
  quarters: Quarter[]; onRecordEdit: (quarter: number, team: MatchTeam, slot: Slot, order: 0 | 1, patch: Partial<Appearance> | null) => void
  quarter: number; team: MatchTeam; setQuarter: (value: number) => void; setTeam: (value: MatchTeam) => void
  entries: PlannedEntry[]; participants: Participant[]; players: Player[]; editable: boolean; referenceYear: number
  onChange: (entries: PlannedEntry[]) => void; tools?: ReactNode; footer: ReactNode; shareControl?: ReactNode; internal?: boolean
  formationA?: Formation | null; formationB?: Formation | null; matchFormat?: MatchFormat | null
}) {
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null)
  const [editingOrder, setEditingOrder] = useState<0 | 1>(0)
  const formation = formationFor({ formationA, formationB }, team)
  const [selected, setSelected] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const { notice, notify } = useTimedNotice()
  const [confirmCopy, setConfirmCopy] = useState(false)
  const [dragPreview, setDragPreview] = useState<{ playerId: number; x: number; y: number } | null>(null)
  const [hoveredPlace, setHoveredPlace] = useState<string | null>(null)
  const drag = useRef<{ playerId: number; x: number; y: number; moved: boolean } | null>(null)
  const skipClick = useRef(false)
  const assignmentPending = internal && unassignedAttendees(participants).length > 0
  const canEdit = editable && !assignmentPending
  const teamParticipants = internal ? participants : undefined
  const candidates = participants.filter(p => p.vote === 'ATTENDING' && (!internal || p.plannedTeam === team)).sort((a, b) => (a.shirtNumber ?? 100) - (b.shirtNumber ?? 100) || a.playerId - b.playerId)
  const allQuarter = entries.filter(a => a.quarterNumber === quarter)
  const q = allQuarter.filter(a => a.team === team)
  const draggedPlayer = candidates.find(p => p.playerId === dragPreview?.playerId)
  const draggedProfile = players.find(p => p.id === dragPreview?.playerId)
  function canPlace(slot: Slot, order: 0 | 1) {
    if (selected === null) return order === 0 || q.some(a => a.slot === slot && a.entryOrder === 0)
    try { placeInPlan(entries, quarter, slot, order, selected, team, teamParticipants); return true } catch { return false }
  }
  function place(slot: Slot, order: 0 | 1, id: number | null) {
    if (!canEdit || id === null || !candidates.some(p => p.playerId === id)) return
    try { onChange(placeInPlan(entries, quarter, slot, order, id, team, teamParticipants)); setSelected(null); setMessage(`${quarterLabel(quarter, matchFormat)} ${internal ? `${team}팀 ` : ''}${slotLabels[slot]} ${order === 0 ? '선발' : '교체'} 배치를 변경했습니다.`) }
    catch (e) { setMessage((e as Error).message) }
  }
  const pitchDrag = usePitchDrag(canEdit, (id, target) => place(target.slot, target.order, id))
  function remove(entry: PlannedEntry) {
    if (!editable) return
    const next = removeFromPlan(entries, entry)
    try { checkPlan(next); onChange(next); setSelected(null); setMessage(entry.entryOrder === 0 && q.some(a => a.slot === entry.slot && a.entryOrder === 1) ? '선발을 해제하고 교체 선수를 선발로 올렸어요.' : '배치를 해제했습니다.') } catch (e) { notify((e as Error).message) }
  }
  function editOverview(targetQuarter: number, targetTeam: MatchTeam, slot: Slot, order: 0 | 1, patch: Partial<Appearance> | null) {
    if (!editable) throw new Error('지금은 수정할 수 없어요.')
    if ((!patch || Object.hasOwn(patch, 'playerId')) && !canEdit) throw new Error('01에서 참석 선수의 A·B팀을 먼저 확인해 주세요.')
    if (!quarterNumbers(matchFormat).includes(targetQuarter)) throw new Error('현재 경기 형식의 쿼터를 선택해 주세요.')
    onRecordEdit(targetQuarter, targetTeam, slot, order, patch); setSelected(null); setMessage('')
  }
  function copyPrevious(confirmed = false) {
    if (!canEdit) return
    if (allQuarter.length && !confirmed) { setConfirmCopy(true); return }
    const next = [...entries.filter(a => a.quarterNumber !== quarter), ...entries.filter(a => a.quarterNumber === quarter - 1).map(a => ({ ...a, quarterNumber: quarter }))]
    try { checkPlan(next, teamParticipants); onChange(next); setSelected(null); setConfirmCopy(false); setMessage('이전 쿼터의 스쿼드를 복사했습니다.') }
    catch (cause) { setConfirmCopy(false); setMessage((cause as Error).message) }
  }
  return <section className="match-block" aria-labelledby="plan-title">
    <FadeToast message={notice?.message ?? ''} identity={notice?.id} tone="info" />
    <div className="match-block-title"><h4 id="plan-title" tabIndex={-1}>02 · 스쿼드 배치</h4><span>{internal ? `${team}팀 · ` : ''}{formationLabel(formation)} · 참석자 직접 배치</span></div>
    <SquadOverview matchFormat={matchFormat} mode="plan" entries={entries} recordQuarters={quarters} participants={participants} formationA={formationA} formationB={formationB} internal={internal} quarter={quarter} team={team} editable={editable} onEdit={editable ? editOverview : undefined} />
    {shareControl}
    {assignmentPending && <p className="import-warning" role="status">참석 선수 중 미배정 {unassignedAttendees(participants).length}명이 있어요. 01에서 A·B팀을 모두 정한 뒤 배치해 주세요.</p>}
    <p className="field-help">작전판의 자리를 누르면 배치할 선수와 교체를 바로 선택할 수 있어요.</p>
    <p className="field-help">배치한 선수를 길게 누른 뒤 다른 자리로 옮기면 이동하거나 서로 바꿔요. 짧게 누르면 선수 목록이 열려요.</p>
    {selected !== null && <div className="planner-selection-status" role="status"><span>{participants.find(p => p.playerId === selected)?.name} 선택 중 · 배치할 자리를 눌러 주세요.</span><button type="button" className="secondary-button" onClick={() => setSelected(null)}>선택 취소</button></div>}
    {tools}
    <div className="quarter-tabs" role="group" aria-label="스쿼드 쿼터 선택">{quarterNumbers(matchFormat).map(n => <button type="button" key={n} aria-pressed={quarter === n} onClick={() => { setQuarter(n); setSelected(null); setMessage(''); setConfirmCopy(false) }}>{quarterLabel(n, matchFormat)} <small>{internal ? `${team}팀 ` : ''}선발 {entries.filter(a => a.quarterNumber === n && a.team === team && a.entryOrder === 0).length}/11</small></button>)}</div>
    {internal && <><TeamSelector team={team} disabled={false} label="스쿼드 편성 팀" counts={{ A: allQuarter.filter(a => a.team === 'A').length, B: allQuarter.filter(a => a.team === 'B').length }} onChange={value => { setTeam(value); setSelected(null); setMessage(''); setConfirmCopy(false) }} />
      <p className="field-help">01에서 나눈 팀 안에서만 배치할 수 있어요. 팀을 바꾸려면 01의 팀 배정을 수정해 주세요.</p></>}
    <div className="planner-layout"><aside className="planner-bench" aria-label="스쿼드 배치 선수">
      <h5>{internal ? `${team}팀 선수` : '참석 선수'} · {candidates.length}명</h5><p className="field-help">각 선수 아래는 {matchPeriodSummary(matchFormat)} 출전 합계예요.</p>
      {!candidates.length && <p>위에서 참석 선수를 먼저 선택해 주세요.</p>}
      {candidates.map(p => { const profile = players.find(player => player.id === p.playerId); const share = entries.filter(a => a.playerId === p.playerId).reduce((sum, a) => sum + plannedShare(entries, a), 0)
        const assigned = allQuarter.find(a => a.playerId === p.playerId)
        const preferences = [profile?.firstChoice, profile?.secondChoice, profile?.thirdChoice].filter(Boolean)
        return <button key={p.playerId} type="button" className={`planner-candidate position-${preferredPositionGroup(profile?.firstChoice ?? null)}${assigned ? ' is-assigned' : ''}${dragPreview?.playerId === p.playerId ? ' is-dragging' : ''}`} disabled={!canEdit || (!!assigned && assigned.team !== team)} aria-pressed={selected === p.playerId}
          onClick={() => { if (skipClick.current) { skipClick.current = false; return } setSelected(selected === p.playerId ? null : p.playerId); setMessage('배치할 자리를 선택하세요.') }}
          onPointerDown={e => { if (!canEdit || e.button !== 0 || e.pointerType === 'touch') return; skipClick.current = false; drag.current = { playerId: p.playerId, x: e.clientX, y: e.clientY, moved: false }; e.currentTarget.setPointerCapture(e.pointerId) }}
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
    </aside><div><div className={`lineup-pitch plan-pitch tactics-pitch${internal ? ` team-pitch-${team.toLowerCase()}` : ''}`} data-pitch-drag-scope data-formation={formation} aria-label={`${quarterLabel(quarter, matchFormat)} ${internal ? `${team}팀 ` : ''}스쿼드 ${formationLabel(formation)}`}><PitchMarkings /><p className="attack-direction">{internal && `${team}팀 · `}공격 방향 ↑</p>
      {pitchRowsFor(formation).map((row, i) => <div className="lineup-row" key={i}>{row.map(slot => {
        const group = slotGroup(slot)
        return <div className={`plan-position position-${group}`} data-position={slot} key={slot}><span className="position-badge">{slotLabels[slot]}</span>{([0, 1] as const).map(order => {
          const entry = q.find(a => a.slot === slot && a.entryOrder === order); const person = participants.find(p => p.playerId === entry?.playerId)
          const emptySubstitute = order === 1 && !entry
          if (emptySubstitute && (!editable || !q.some(a => a.slot === slot && a.entryOrder === 0))) return null
          const validTarget = selected === null ? true : canPlace(slot, order)
          return <div className={`plan-place${order === 1 ? ' is-substitute' : ''}${emptySubstitute ? ' is-empty-substitute' : ''}`} key={order}><button type="button" className={`${entry ? 'plan-filled ' : ''}${selected !== null && validTarget ? 'plan-drop-ready ' : ''}${hoveredPlace === `${slot}:${order}` || pitchDrag.preview?.target === `${slot}:${order}` ? 'plan-drop-hover' : ''}`} disabled={!canEdit || !validTarget}
            data-plan-slot={slot} data-plan-order={order} data-pitch-slot={slot} data-pitch-order={order} {...pitchDrag.bind(entry?.playerId)}
            aria-pressed={!!entry && selected === entry.playerId}
            aria-label={`${quarterLabel(quarter, matchFormat)} 스쿼드 ${slotLabels[slot]} ${order === 0 ? '선발' : '교체'} 자리`}
            aria-haspopup={selected === null ? 'dialog' : undefined}
            title={emptySubstitute ? '교체 선수를 선택하세요.' : undefined}
            onClick={() => {
              if (pitchDrag.consumeClick()) return
              if (selected === null) { setEditingOrder(order); setEditingSlot(slot); return }
              if (entry && selected === entry.playerId) { setSelected(null); setMessage('선택을 취소했어요.'); return }
              if (entry && selected === null) { setSelected(entry.playerId); setMessage('바꿀 선수 또는 빈 자리를 눌러 주세요.'); return }
              if (emptySubstitute && selected === null) { setMessage('참석 선수에서 교체할 선수를 먼저 선택한 뒤, 이 자리의 + 교체를 눌러 주세요.'); return }
              place(slot, order, selected)
            }}>
            {emptySubstitute ? <span>+ 교체</span> : <><small>{entry ? '✓ ' : ''}{order === 0 ? '선발' : '교체'}{entry ? ` · ${plannedShare(entries, entry)}Q` : ''}</small><strong>{person ? playerLabel(person) : '+ 배치'}</strong></>}
          </button>{entry && editable && <button type="button" className="plan-remove" aria-label={`${quarterLabel(quarter, matchFormat)} ${slotLabels[slot]} ${order === 0 ? '선발' : '교체'} 배치 해제`} onClick={() => remove(entry)}>×</button>}</div>
        })}</div>
      })}</div>)}
    </div><div className="import-tools">{editable && quarter > 1 && <button type="button" className="secondary-button" disabled={!canEdit} onClick={() => copyPrevious()}>{internal ? '이전 쿼터 양 팀 스쿼드 복사' : '이전 쿼터 스쿼드 복사'}</button>}
      </div>
    <p className="field-help">골·도움은 03 결과·코멘트에서 입력해요. 교체한 두 선수는 각각 0.5쿼터예요.</p></div></div>
    {confirmCopy && <div className="conflict-notice" role="alert"><p>현재 {quarterLabel(quarter, matchFormat)} {internal ? '양 팀 ' : ''}스쿼드를 이전 쿼터 스쿼드로 교체할까요?</p><button type="button" className="secondary-button" onClick={() => copyPrevious(true)}>현재 스쿼드 교체</button> <button type="button" className="secondary-button" onClick={() => setConfirmCopy(false)}>복사 취소</button></div>}
    <p role="status" className="planner-result-status">{message || '배치한 내용은 저장 버튼을 눌러 저장해 주세요.'}</p>
    {editingSlot && <OverviewPositionEditor matchFormat={matchFormat} mode="plan" initialOrder={editingOrder} slot={editingSlot} quarter={quarter} team={team} internal={internal}
      participants={participants} entries={quarters.find(q => q.number === quarter)?.lineup ?? []} editable={editable}
      onEdit={(order, patch) => editOverview(quarter, team, editingSlot, order, patch)} onClose={() => setEditingSlot(null)} />}
    {footer}
    <PitchDragPreview preview={pitchDrag.preview} name={participants.find(p => p.playerId === pitchDrag.preview?.id)?.name ?? '선수'} />
    {dragPreview && draggedPlayer && createPortal(<div className={`planner-drag-card position-${preferredPositionGroup(draggedProfile?.firstChoice ?? null)}`} style={{ left: dragPreview.x, top: dragPreview.y }} aria-hidden="true">
      <strong>{playerLabel(draggedPlayer)}</strong><small>{draggedProfile?.firstChoice ?? '미확인'} · {quarterLabel(quarter, matchFormat)} 배치</small><span>{hoveredPlace ? '여기에 놓기' : '강조된 자리에 놓으세요'}</span>
    </div>, document.body)}
  </section>
}
