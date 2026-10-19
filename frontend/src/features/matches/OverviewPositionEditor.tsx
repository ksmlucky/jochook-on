import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { canPlay, slotLabels } from './api'
import type { Appearance, MatchTeam, Participant, PlannedEntry, Slot } from './api'
import { usePitchDialog } from './usePitchDialog'
import { slotGroup } from './formations'
import { quarterLabel } from './matchFormat'
import type { MatchFormat } from './matchFormat'

export type OverviewEntry = PlannedEntry | Appearance

export function OverviewPositionEditor({ mode, slot, quarter, team, internal, participants, entries, editable, onEdit, onClose, matchFormat, initialOrder = 0 }: {
  initialOrder?: 0 | 1
  mode: 'plan' | 'actual'; slot: Slot; quarter: number; team: MatchTeam; internal: boolean
  participants: Participant[]; entries: OverviewEntry[]; editable: boolean; matchFormat?: MatchFormat | null
  onEdit: (order: 0 | 1, patch: Partial<Appearance> | null) => void; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const fieldsId = useId()
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const atSlot = entries.filter(entry => entry.team === team && entry.slot === slot)
  const starter = atSlot.find(entry => entry.entryOrder === 0)
  const candidates = participants.filter(player => mode === 'plan'
    ? player.vote === 'ATTENDING' && (!internal || player.plannedTeam === team)
    : canPlay(player))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko') || (a.shirtNumber ?? 100) - (b.shirtNumber ?? 100) || a.playerId - b.playerId)

  usePitchDialog(dialog)
  const close = () => onClose()
  function edit(order: 0 | 1, patch: Partial<Appearance> | null) {
    if (!editable) return false
    try {
      if (mode === 'plan' && internal && patch?.playerId !== undefined && !participants.some(player => player.playerId === patch.playerId && player.plannedTeam === team)) {
        throw new Error(`${team}팀에 지정한 선수만 배치할 수 있어요. 01에서 팀을 먼저 확인해 주세요.`)
      }
      onEdit(order, patch); setError('')
      return true
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : '입력 내용을 확인해 주세요.'); return false }
  }

  return createPortal(<dialog ref={dialog} className="overview-position-editor" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); close() }}>
    <div className="overview-editor-heading"><h3 id={titleId}>{quarterLabel(quarter, matchFormat)} {internal ? `${team}팀 ` : ''}{slotLabels[slot]} {initialOrder === 0 ? '선발' : '교체'} 선택</h3>
      <button type="button" className="secondary-button" onClick={close}>닫기</button></div>
    <fieldset disabled={!editable}>
      <legend className="sr-only">선수 선택</legend>
      {[initialOrder].map(order => {
        const entry = atSlot.find(item => item.entryOrder === order)
        const label = order === 0 ? '선발' : '교체'
        return <div className={`overview-editor-entry${order === 1 ? ' is-substitute' : ''}`} key={order}>
          {editable && (order === 0 || starter) && <div className="overview-player-picker">
            <label className="sr-only" htmlFor={`${fieldsId}-search`}>이름 또는 등번호 찾기</label>
            <input id={`${fieldsId}-search`} type="search" placeholder="이름 또는 등번호" value={search} onChange={event => setSearch(event.target.value)} />
            {!candidates.some(candidate => !search.trim() || candidate.name.includes(search.trim()) || String(candidate.shirtNumber ?? '').includes(search.trim())) && <p className="field-help">선택할 선수가 없어요. 참석 명단이나 검색어를 확인해 주세요.</p>}
            <div className="overview-player-options" role="group" aria-label={`${label} 선수 선택`}>
              {candidates.filter(candidate => !search.trim() || candidate.name.includes(search.trim()) || String(candidate.shirtNumber ?? '').includes(search.trim())).map(candidate => {
                const assigned = entries.find(item => item.playerId === candidate.playerId)
                const isCurrent = assigned?.team === team && assigned.slot === slot && assigned.entryOrder === order
                const blocked = !!assigned && !isCurrent && (mode === 'actual' || assigned.team !== team)
                return <button key={candidate.playerId} type="button" disabled={blocked} aria-pressed={isCurrent}
                  className={assigned ? `is-assigned position-${slotGroup(assigned.slot)}` : undefined}
                  onClick={() => { if (edit(order, { playerId: candidate.playerId })) close() }}>
                  <small>{candidate.shirtNumber === null ? candidate.playerType === 'GUEST' ? '용병' : '등번호 없음' : `#${candidate.shirtNumber}`}</small><strong>{candidate.name}</strong>
                  <small className="overview-player-assignment">{assigned ? `${assigned.team !== team ? `${assigned.team}팀 · ` : ''}${slotLabels[assigned.slot]}` : '미배치'}</small>
                </button>
              })}
            </div>
            {entry && <button type="button" className="secondary-button" onClick={() => { if (edit(order, null)) close() }}>{label} 해제</button>}
          </div>}
        </div>
      })}
    </fieldset>
    {error && <p className="overview-editor-error" role="alert">{error}</p>}
  </dialog>, document.body)
}
