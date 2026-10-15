import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { playerLabel, quarterShare, slotLabels } from './api'
import type { Appearance, MatchTeam, Participant, PlannedEntry, Quarter, Slot } from './api'
import { formationFor, formationLabel, pitchRowsFor, slotGroup, slotPosition } from './formations'
import type { Formation } from './formations'
import { plannedShare } from './plan'
import { PitchMarkings } from './PitchMarkings'
import { OverviewPositionEditor } from './OverviewPositionEditor'
import './squad-overview.css'

type Props = {
  participants: Participant[]; formationA?: Formation | null; formationB?: Formation | null
  internal: boolean; quarter: number; team: MatchTeam; editable?: boolean
  onEdit?: (quarter: number, team: MatchTeam, slot: Slot, order: 0 | 1, patch: Partial<Appearance> | null) => void
} & ({ mode: 'plan'; entries: PlannedEntry[] } | { mode: 'actual'; quarters: Quarter[] })

/** Browsing keeps its own quarter/team; edits explicitly flow into the existing draft. */
export function SquadOverview(props: Props) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className="secondary-button squad-overview-trigger" aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <span aria-hidden="true">⛶</span> 스쿼드 한눈에 보기
    </button>
    {open && <OverviewDialog {...props} onClose={() => setOpen(false)} />}
  </>
}

function OverviewDialog(props: Props & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [quarter, setQuarter] = useState(props.quarter)
  const [team, setTeam] = useState(props.team)
  const [selected, setSelected] = useState<Slot | null>(null)
  const [editing, setEditing] = useState(false)
  const canEdit = !!props.editable && !!props.onEdit
  const formation = formationFor(props, team)
  const actualQuarter = props.mode === 'actual' ? props.quarters.find(item => item.number === quarter) : undefined
  const entries = props.mode === 'plan'
    ? props.entries.filter(entry => entry.quarterNumber === quarter && entry.team === team)
    : (actualQuarter?.lineup ?? []).filter(entry => entry.team === team)
  const person = (id: number) => props.participants.find(player => player.playerId === id)
  const share = (slot: Slot, entryOrder: number) => {
    if (props.mode === 'plan') {
      const entry = props.entries.find(item => item.team === team && item.quarterNumber === quarter && item.slot === slot && item.entryOrder === entryOrder)
      return entry ? plannedShare(props.entries, entry) : 0
    }
    const entry = actualQuarter?.lineup.find(item => item.team === team && item.slot === slot && item.entryOrder === entryOrder)
    return actualQuarter && entry ? quarterShare(actualQuarter, entry) : 0
  }
  const selectedEntries = entries.filter(entry => entry.slot === selected).sort((a, b) => a.entryOrder - b.entryOrder)
  const waiting = props.participants.filter(player =>
    (props.mode === 'plan' ? player.vote === 'ATTENDING' : ['PRESENT', 'LATE'].includes(player.attendance)) &&
    !(props.mode === 'plan'
      ? props.entries.some(entry => entry.quarterNumber === quarter && entry.playerId === player.playerId)
      : actualQuarter?.lineup.some(entry => entry.playerId === player.playerId)))

  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  const close = () => { dialog.current?.close(); props.onClose() }

  return createPortal(<dialog ref={dialog} className="squad-overview-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close() }}>
    <div className="squad-overview-content">
      <header className="squad-overview-heading">
        <div><h3 id={titleId}>{props.mode === 'plan' ? '02 스쿼드 계획' : '03 실제 출전'}</h3><p>현재 입력 기준 · {formationLabel(formation)}</p></div>
        <button type="button" className="secondary-button" onClick={close}>닫기</button>
      </header>
      <div className="squad-overview-controls">
        <div role="group" aria-label="한눈에 보기 쿼터">{[1, 2, 3, 4].map(number => <button key={number} type="button" aria-pressed={quarter === number} onClick={() => { setQuarter(number); setSelected(null) }}>{number}쿼터</button>)}</div>
        {props.internal && <div role="group" aria-label="한눈에 보기 팀">{(['A', 'B'] as const).map(value => <button key={value} type="button" aria-pressed={team === value} onClick={() => { setTeam(value); setSelected(null) }}>{value}팀</button>)}</div>}
      </div>
      <p className="squad-overview-counts">{props.internal ? `${team}팀 · ` : ''}선발 {entries.filter(entry => entry.entryOrder === 0).length}/11 · 교체 {entries.filter(entry => entry.entryOrder === 1).length}명<span>공격 방향 ↑</span></p>
      <div className="tactics-pitch squad-overview-pitch" data-formation={formation} aria-label={`${quarter}쿼터 ${props.internal ? `${team}팀 ` : ''}${formationLabel(formation)} 전체 스쿼드`}>
        <PitchMarkings />
        {pitchRowsFor(formation).flat().map(slot => {
          const starter = entries.find(entry => entry.slot === slot && entry.entryOrder === 0)
          const sub = entries.find(entry => entry.slot === slot && entry.entryOrder === 1)
          const starterPlayer = starter && person(starter.playerId)
          const subPlayer = sub && person(sub.playerId)
          const starterShare = share(slot, 0)
          const subShare = share(slot, 1)
          return <button type="button" key={slot} data-position={slot} className={`squad-overview-card position-${slotGroup(slot)}`}
            aria-pressed={selected === slot}
            aria-label={`${slotLabels[slot]} · ${starterPlayer ? `${playerLabel(starterPlayer)} ${starterShare}쿼터` : '선발 미배치'}${subPlayer ? ` · 교체 ${playerLabel(subPlayer)} ${subShare}쿼터` : ''} · ${canEdit ? '수정' : '상세 보기'}`}
            aria-haspopup={canEdit ? 'dialog' : undefined}
            onClick={() => { setSelected(slot); if (canEdit) setEditing(true) }}>
            <span className="squad-overview-position">{slotPosition(slot)}<small>{starterPlayer?.shirtNumber != null ? `#${starterPlayer.shirtNumber}` : starterPlayer?.playerType === 'GUEST' ? '용병' : '—'}</small></span>
            <strong className="squad-overview-name">{starterPlayer?.name ?? '미배치'}</strong>
            {sub && <span className="squad-overview-swap"><span>↳ {subPlayer?.name ?? '선수 미확인'}</span><small>각 {starterShare === subShare ? starterShare : `${starterShare}/${subShare}`}Q</small></span>}
          </button>
        })}
      </div>
      <div className="squad-overview-detail" aria-live="polite" aria-atomic="true">
        {selected ? <><strong>{slotLabels[selected]} 상세</strong>{selectedEntries.length ? selectedEntries.map(entry => <p key={entry.entryOrder}>
          <span>{entry.entryOrder === 0 ? '선발' : '교체'} · {person(entry.playerId) ? playerLabel(person(entry.playerId)!) : '선수 미확인'}</span>
          <small>{share(entry.slot, entry.entryOrder)}쿼터{props.mode === 'actual' && 'goals' in entry ? ` · ${entry.goals}골 · ${entry.assists}도움` : ' 예정'}</small>
        </p>) : <p>아직 배치한 선수가 없어요.</p>}</> : <p>자리를 누르면 {canEdit ? `${props.mode === 'actual' ? '출전·교체·골·도움을' : '선발·교체 배치를'} 바로 수정할 수 있어요.` : `전체 이름과 ${props.mode === 'actual' ? '교체·골·도움을' : '교체를'} 확인할 수 있어요.`}</p>}
      </div>
      <details className="squad-overview-waiting"><summary>이번 쿼터 미배치 {waiting.length}명</summary><p>{waiting.map(playerLabel).join(', ') || '모두 배치되어 있어요.'}</p></details>
      <p className="squad-overview-note">{props.onEdit ? '변경은 초안에 반영돼요. 전체보기를 닫고 단계별 저장을 눌러 주세요.' : '현재 입력 내용을 확인하는 화면이에요.'}</p>
    </div>
    {editing && selected && props.onEdit && <OverviewPositionEditor key={`${quarter}-${team}-${selected}`} mode={props.mode} slot={selected} quarter={quarter} team={team} internal={props.internal}
      participants={props.participants} entries={props.mode === 'plan' ? props.entries.filter(entry => entry.quarterNumber === quarter) : actualQuarter?.lineup ?? []}
      editable={canEdit} onEdit={(order, patch) => props.onEdit!(quarter, team, selected, order, patch)} onClose={() => setEditing(false)} />}
  </dialog>, document.body)
}
