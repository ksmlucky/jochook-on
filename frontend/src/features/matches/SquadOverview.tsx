import { usePitchDrag, PitchDragPreview } from './usePitchDrag'
import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { playerLabel, quarterShare, slotLabels } from './api'
import type { Appearance, MatchTeam, Participant, PlannedEntry, Quarter, Slot } from './api'
import { formationFor, formationLabel, pitchRowsFor, slotGroup, slotPosition } from './formations'
import type { Formation } from './formations'
import { plannedShare } from './plan'
import { PitchMarkings } from './PitchMarkings'
import { OverviewPositionEditor } from './OverviewPositionEditor'
import { goalBreakdownText } from './goalBreakdown'
import './squad-overview.css'
import { usePitchDialog } from './usePitchDialog'
import { quarterLabel, quarterNumbers } from './matchFormat'
import type { MatchFormat } from './matchFormat'

type Props = {
  participants: Participant[]; formationA?: Formation | null; formationB?: Formation | null; matchFormat?: MatchFormat | null
  recordQuarters?: Quarter[]; internal: boolean; quarter: number; team: MatchTeam; editable?: boolean
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
  const [quarter, setQuarter] = useState(quarterNumbers(props.matchFormat).includes(props.quarter) ? props.quarter : 1)
  const [team, setTeam] = useState(props.team)
  const [selected, setSelected] = useState<Slot | null>(null)
  const [editing, setEditing] = useState(false)
  const [editingOrder, setEditingOrder] = useState<0 | 1>(0)
  const [swapMessage, setSwapMessage] = useState('')
  const canEdit = !!props.editable && !!props.onEdit
  const formation = formationFor(props, team)
  const actualQuarter = (props.mode === 'actual' ? props.quarters : props.recordQuarters)?.find(item => item.number === quarter)
  const entries = props.mode === 'plan' && !props.recordQuarters
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
    !(props.mode === 'plan' && props.internal && player.plannedTeam !== team) &&
    !(props.mode === 'plan'
      ? props.entries.some(entry => entry.quarterNumber === quarter && entry.playerId === player.playerId)
      : actualQuarter?.lineup.some(entry => entry.playerId === player.playerId)))

  usePitchDialog(dialog)
  const close = () => props.onClose()
  const pitchDrag = usePitchDrag(canEdit && props.mode === 'plan', (id, target) => {
    try { props.onEdit!(quarter, team, target.slot, target.order, { playerId: id }); setSwapMessage('배치를 변경했어요. 단계별 저장을 눌러 주세요.') }
    catch (cause) { setSwapMessage((cause as Error).message) }
  })
  function chooseSlot(slot: Slot) {
    if (pitchDrag.consumeClick()) return
    setSelected(slot); setEditingOrder(0)
    if (canEdit) setEditing(true)
  }

  return createPortal(<dialog ref={dialog} className="squad-overview-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close() }}>
    <div className="squad-overview-content">
      <header className="squad-overview-heading">
        <div><h3 id={titleId}>{props.mode === 'plan' ? '02 스쿼드·기록' : '03 실제 출전'}</h3><p>현재 입력 기준 · {formationLabel(formation)}</p></div>
        <button type="button" className="secondary-button" onClick={close}>닫기</button>
      </header>
      <div className="squad-overview-controls">
        <div role="group" aria-label="한눈에 보기 쿼터">{quarterNumbers(props.matchFormat).map(number => <button key={number} type="button" aria-pressed={quarter === number} onClick={() => { setQuarter(number); setSelected(null); setSwapMessage('') }}>{quarterLabel(number, props.matchFormat)}</button>)}</div>
        {props.internal && <div role="group" aria-label="한눈에 보기 팀">{(['A', 'B'] as const).map(value => <button key={value} type="button" aria-pressed={team === value} onClick={() => { setTeam(value); setSelected(null); setSwapMessage('') }}>{value}팀</button>)}</div>}
      </div>
      {canEdit && <p className="field-help" role="status">{swapMessage || '짧게 눌러 선수 선택 · 길게 눌러 이동·교환'}</p>}
      <p className="squad-overview-counts">{props.internal ? `${team}팀 · ` : ''}선발 {entries.filter(entry => entry.entryOrder === 0).length}/11 · 교체 {entries.filter(entry => entry.entryOrder === 1).length}명<span>공격 방향 ↑</span></p>
      <div className="tactics-pitch squad-overview-pitch" data-pitch-drag-scope data-formation={formation} aria-label={`${quarterLabel(quarter, props.matchFormat)} ${props.internal ? `${team}팀 ` : ''}${formationLabel(formation)} 전체 스쿼드`}>
        <PitchMarkings />
        {pitchRowsFor(formation).flat().map(slot => {
          const starter = entries.find(entry => entry.slot === slot && entry.entryOrder === 0)
          const sub = entries.find(entry => entry.slot === slot && entry.entryOrder === 1)
          const starterPlayer = starter && person(starter.playerId)
          const subPlayer = sub && person(sub.playerId)
          const starterShare = share(slot, 0)
          const subShare = share(slot, 1)
          return <div key={slot} data-position={slot} className={`squad-overview-slot position-${slotGroup(slot)}`}><button type="button" className={`squad-overview-card${pitchDrag.preview?.target === `${slot}:0` ? ' pitch-drop-hover' : ''}`} data-pitch-slot={slot} data-pitch-order={0} {...pitchDrag.bind(starter?.playerId)}
            aria-pressed={selected === slot}
            aria-label={`${slotLabels[slot]} · ${starterPlayer ? `${playerLabel(starterPlayer)} ${starterShare}쿼터` : '선발 미배치'}${subPlayer ? ` · 교체 ${playerLabel(subPlayer)} ${subShare}쿼터` : ''} · ${canEdit ? '수정' : '상세 보기'}`}
            aria-haspopup={canEdit ? 'dialog' : undefined}
            onClick={() => chooseSlot(slot)}>
            <span className="squad-overview-position">{slotPosition(slot) === 'CB' ? slotLabels[slot] : slotPosition(slot)}<small>{starterPlayer?.shirtNumber != null ? `#${starterPlayer.shirtNumber}` : starterPlayer?.playerType === 'GUEST' ? '용병' : '—'}</small></span>
            <strong className="squad-overview-name">{starterPlayer?.name ?? '미배치'}</strong>
            {sub && <span className="squad-overview-swap"><span>↳ {subPlayer?.name ?? '선수 미확인'}</span><small>각 {starterShare === subShare ? starterShare : `${starterShare}/${subShare}`}Q</small></span>}
          </button>
            {canEdit && starter && <button type="button" className={`squad-overview-sub${pitchDrag.preview?.target === `${slot}:1` ? ' pitch-drop-hover' : ''}`} data-pitch-slot={slot} data-pitch-order={1} {...pitchDrag.bind(sub?.playerId)} aria-label={`${slotLabels[slot]} 교체 선수 선택`} onClick={() => { if (pitchDrag.consumeClick()) return; setSelected(slot); setEditingOrder(1); setEditing(true) }}>{subPlayer ? `교체 ${subPlayer.name}` : '+ 교체'}</button>}
          </div>
        })}
      </div>
      <div className="squad-overview-detail" aria-live="polite" aria-atomic="true">
        {selected ? <><strong>{slotLabels[selected]} 상세</strong>{selectedEntries.length ? selectedEntries.map(entry => <p key={entry.entryOrder}>
          <span>{entry.entryOrder === 0 ? '선발' : '교체'} · {person(entry.playerId) ? playerLabel(person(entry.playerId)!) : '선수 미확인'}</span>
          <small>{share(entry.slot, entry.entryOrder)}쿼터{(props.mode === 'actual' || props.recordQuarters) && 'goals' in entry ? ` · ${entry.goals}골 · ${entry.assists}도움` : ' 예정'}</small>
          {(props.mode === 'actual' || props.recordQuarters) && 'goals' in entry && <small>{goalBreakdownText(entry)}</small>}
        </p>) : <p>아직 배치한 선수가 없어요.</p>}</> : <p>자리를 누르면 {canEdit ? '선발을 수정하고, + 교체로 교체 선수를 선택할 수 있어요.' : `전체 이름과 ${props.mode === 'actual' || props.recordQuarters ? '교체·골·도움을' : '교체를'} 확인할 수 있어요.`}</p>}
      </div>
      <details className="squad-overview-waiting"><summary>이번 쿼터 미배치 {waiting.length}명</summary><p>{waiting.map(playerLabel).join(', ') || '모두 배치되어 있어요.'}</p></details>
      <p className="squad-overview-note">{props.onEdit ? '변경은 초안에 반영돼요. 전체보기를 닫고 단계별 저장을 눌러 주세요.' : '현재 입력 내용을 확인하는 화면이에요.'}</p>
    </div>
    <PitchDragPreview preview={pitchDrag.preview} name={person(pitchDrag.preview?.id ?? -1)?.name ?? '선수'} />
    {editing && selected && props.onEdit && <OverviewPositionEditor key={`${quarter}-${team}-${selected}`} matchFormat={props.matchFormat} mode={props.mode} initialOrder={editingOrder} slot={selected} quarter={quarter} team={team} internal={props.internal}
      participants={props.participants} entries={props.mode === 'plan' && !props.recordQuarters ? props.entries.filter(entry => entry.quarterNumber === quarter) : actualQuarter?.lineup ?? []}
      editable={canEdit} onEdit={(order, patch) => props.onEdit!(quarter, team, selected, order, patch)} onClose={() => setEditing(false)} />}
  </dialog>, document.body)
}
