import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { canPlay, playerLabel, slotLabels } from './api'
import type { Appearance, MatchTeam, Participant, PlannedEntry, Slot } from './api'
import { GoalBreakdownFields } from './GoalBreakdownFields'
import { quarterLabel } from './matchFormat'
import type { MatchFormat } from './matchFormat'

export type OverviewEntry = PlannedEntry | Appearance

export function OverviewPositionEditor({ mode, slot, quarter, team, internal, participants, entries, editable, onEdit, onClose, matchFormat, recordStats = false }: {
  recordStats?: boolean; mode: 'plan' | 'actual'; slot: Slot; quarter: number; team: MatchTeam; internal: boolean
  participants: Participant[]; entries: OverviewEntry[]; editable: boolean; matchFormat?: MatchFormat | null
  onEdit: (order: 0 | 1, patch: Partial<Appearance> | null) => void; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const fieldsId = useId()
  const [error, setError] = useState('')
  const [changed, setChanged] = useState(false)
  const atSlot = entries.filter(entry => entry.team === team && entry.slot === slot)
  const starter = atSlot.find(entry => entry.entryOrder === 0)
  const hasSub = atSlot.some(entry => entry.entryOrder === 1)
  const share = hasSub ? 0.5 : 1
  const candidates = participants.filter(player => mode === 'plan'
    ? player.vote === 'ATTENDING' && (!internal || player.plannedTeam === team)
    : canPlay(player))
    .sort((a, b) => (a.shirtNumber ?? 100) - (b.shirtNumber ?? 100) || a.name.localeCompare(b.name, 'ko') || a.playerId - b.playerId)

  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  const close = () => { dialog.current?.close(); onClose() }
  function edit(order: 0 | 1, patch: Partial<Appearance> | null) {
    if (!editable) return
    try {
      if (mode === 'plan' && internal && patch?.playerId !== undefined && !participants.some(player => player.playerId === patch.playerId && player.plannedTeam === team)) {
        throw new Error(`${team}팀에 지정한 선수만 배치할 수 있어요. 01에서 팀을 먼저 확인해 주세요.`)
      }
      onEdit(order, patch); setError(''); setChanged(true)
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : '입력 내용을 확인해 주세요.') }
  }

  return createPortal(<dialog ref={dialog} className="overview-position-editor" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); close() }}>
    <div className="overview-editor-heading"><h3 id={titleId}>{quarterLabel(quarter, matchFormat)} {internal ? `${team}팀 ` : ''}{slotLabels[slot]} 수정</h3>
      <button type="button" className="secondary-button" onClick={close}>닫기</button></div>
    <p className="overview-editor-hint">{mode === 'plan' ? `${internal ? `01에서 ${team}팀으로 정한 ` : ''}참석 선수 중에서 배치해요. 이미 배치한 같은 팀 선수는 이동하거나 서로 자리를 바꿔요.` : '실제 참석·지각한 선수 중에서 선택해요. 골·도움이 있는 선수를 바꾸려면 기록을 먼저 정정해 주세요.'}</p>
    <fieldset disabled={!editable}>
      <legend className="sr-only">선발과 교체 수정</legend>
      {([0, 1] as const).map(order => {
        const entry = atSlot.find(item => item.entryOrder === order)
        const player = participants.find(item => item.playerId === entry?.playerId)
        const label = order === 0 ? '선발' : '교체'
        return <div className={`overview-editor-entry${order === 1 ? ' is-substitute' : ''}`} key={order}>
          <label htmlFor={`${fieldsId}-${order}`}>{label}{entry ? ` · ${share}쿼터${mode === 'plan' && !recordStats ? ' 예정' : ''}` : ''}</label>
          <select id={`${fieldsId}-${order}`} aria-label={`${label} 선수`} value={entry?.playerId ?? ''} disabled={!editable || (order === 1 && !starter)}
            onChange={event => edit(order, event.target.value ? { playerId: Number(event.target.value) } : null)}>
            <option value="">{order === 0 ? '미배치 / 선발 해제' : starter ? '교체 없음 / 교체 해제' : '선발을 먼저 선택하세요'}</option>
            {player && !candidates.some(candidate => candidate.playerId === player.playerId) && <option value={player.playerId}>{playerLabel(player)} · {mode === 'plan' ? internal && player.plannedTeam !== team ? '팀' : '투표' : '출석'} 확인 필요</option>}
            {candidates.map(candidate => {
              const assigned = entries.find(item => item.playerId === candidate.playerId)
              const isCurrent = assigned?.team === team && assigned.slot === slot && assigned.entryOrder === order
              const blocked = !!assigned && !isCurrent && (mode === 'actual' || assigned.team !== team)
              return <option key={candidate.playerId} value={candidate.playerId} disabled={blocked}>
                {playerLabel(candidate)}{assigned && !isCurrent ? assigned.team !== team ? ' · 다른 팀 배치' : mode === 'actual' ? ' · 이미 출전' : ` · ${slotLabels[assigned.slot]} ${assigned.entryOrder === 0 ? '선발' : '교체'} · 이동/교환` : ''}
              </option>
            })}
          </select>
          {(mode === 'actual' || recordStats) && entry && 'goals' in entry && <div className="overview-editor-stats">
            <label>총 골<input aria-label={`${label} 골`} type="number" inputMode="numeric" min={0} max={99} step={1} value={entry.goals}
              onChange={event => edit(order, { goals: event.target.valueAsNumber })} /></label>
            <label>도움<input aria-label={`${label} 도움`} type="number" inputMode="numeric" min={0} max={99} step={1} value={entry.assists}
              onChange={event => edit(order, { assists: event.target.valueAsNumber })} /></label>
          </div>}
          {(mode === 'actual' || recordStats) && entry && 'goals' in entry && <GoalBreakdownFields entry={entry} label={label} editable={editable} expanded onChange={patch => edit(order, patch)} />}
        </div>
      })}
    </fieldset>
    {error && <p className="overview-editor-error" role="alert">{error}</p>}
    <p className="overview-editor-notice" role="status">{changed ? '초안에 반영했어요. ' : ''}작전판으로 돌아가 저장을 눌러 주세요.</p>
    <button type="button" className="primary-button overview-editor-done" onClick={close}>입력 완료 · 작전판으로</button>
  </dialog>, document.body)
}
