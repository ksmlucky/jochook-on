import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { SessionExpiredError } from '../auth/api'
import type { Player } from '../players/api'
import { attendanceLabels, canPlay, emptyMatch, MatchRequestError, pitchRows, playerLabel, quarterShare, saveMatch, shirtLabel, voteLabels } from './api'
import type { Appearance, Attendance, MatchDraft, MatchImportPreview, MatchKind, MatchRecord, MatchTeam, Participant, Slot, Vote } from './api'
import { MatchWorkbookImport } from './MatchWorkbookImport'
import { LineupPosition } from './LineupPosition'
import { ageBand, ageDescription } from '../players/age'
import { AttendeePicker } from './AttendeePicker'
import { MatchPlanner } from './MatchPlanner'
import { AutomaticLineup } from './AutomaticLineup'
import { GuestPicker } from './GuestPicker'
import { actualFromPlan } from './plan'
import { kickoffHours, kickoffMinutes, matchTimeRange, validKickoff } from './time'
import { TeamSelector } from './TeamSelector'

const editorSteps = ['투표·출석', '스쿼드 계획', '실제 출전', '결과·코멘트']
const stepHeadings = ['attendance-title', 'plan-title', 'lineup-title', 'match-totals']

export function MatchEditor({ record: initialRecord, players: initialPlayers, isAdmin, onSaved, onStepSaved, onClose, onSessionExpired }: {
  record: MatchRecord | null; players: Player[]; isAdmin: boolean; onSaved: (record: MatchRecord) => void; onStepSaved: (message: string) => void; onClose: () => void; onSessionExpired: () => void
}) {
  // 단계 저장 이후에도 편집을 유지하며 다음 저장은 새 ID/version으로 갱신한다.
  const [record, setRecord] = useState(initialRecord)
  const [players, setPlayers] = useState(initialPlayers)
  const [draft, setDraft] = useState<MatchDraft>(() => record ?? emptyMatch(players))
  // 한쪽만 선택한 상태도 유지하되, 두 값이 있어야 저장할 시간을 만든다.
  const [kickoffHour, setKickoffHour] = useState(() => validKickoff(initialRecord?.kickoff ?? null) ? initialRecord!.kickoff!.slice(0, 2) : '')
  const [kickoffMinute, setKickoffMinute] = useState(() => validKickoff(initialRecord?.kickoff ?? null) ? initialRecord!.kickoff!.slice(3, 5) : '')
  const [quarter, setQuarter] = useState(1)
  const [team, setTeam] = useState<MatchTeam>('A')
  const [step, setStep] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const [addedPlayer, setAddedPlayer] = useState('')
  const [planRevision, setPlanRevision] = useState(0)
  const submitting = useRef(false)
  const errorMessage = useRef<HTMLParagraphElement>(null)
  const q = draft.quarters.find(q => q.number === quarter)!
  const internal = draft.kind === 'INTERNAL'
  const teamLineup = q.lineup.filter(a => a.team === team)
  const kindLocked = !!record || !!draft.plannedLineup.length || draft.quarters.some(q => q.lineup.length > 0) || draft.scoreFor !== null || draft.scoreAgainst !== null
  const referenceYear = Number(draft.playedOn.slice(0, 4))
  const eligible = draft.participants.filter(canPlay)
  const editable = isAdmin && !busy && !blocked
  const missingPlayers = players.filter(p => p.playerType !== 'GUEST' && !draft.participants.some(a => a.playerId === p.id))
  useEffect(() => { if (error) errorMessage.current?.focus() }, [error])
  useEffect(() => { document.getElementById('match-editor-title')?.scrollIntoView({ block: 'start' }) }, [])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  function change(next: MatchDraft) { setDraft(next); setDirty(true); setConfirmClose(false); setError('') }
  function changeKickoff(hour: string, minute: string) {
    setKickoffHour(hour); setKickoffMinute(minute)
    change({ ...draft, kickoff: hour && minute ? `${hour}:${minute}` : null })
  }
  function goToStep(id: string) {
    setStep(Math.max(0, stepHeadings.indexOf(id)))
    requestAnimationFrame(() => {
      const panel = document.getElementById('match-step-tabs')
      panel?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      document.getElementById(id)?.focus({ preventScroll: true })
    })
  }
  function participant(id: number, patch: Partial<Participant>) {
    if (patch.vote && patch.vote !== 'ATTENDING' && draft.plannedLineup.some(a => a.playerId === id)) {
      setError('계획 스쿼드에 배치한 선수입니다. 해당 선수의 계획 배치를 먼저 해제한 뒤 투표를 바꿔 주세요.'); return
    }
    if (patch.attendance && !['PRESENT', 'LATE'].includes(patch.attendance) && draft.quarters.some(q => q.lineup.some(a => a.playerId === id))) {
      setError('출전 기록이 있는 선수입니다. 쿼터 배치와 득점·도움 기록을 먼저 확인하고 배치를 해제한 뒤 출석을 바꿔 주세요.'); return
    }
    setError(''); change({ ...draft, participants: draft.participants.map(p => p.playerId === id ? { ...p, ...patch } : p) })
  }
  function selectAttendee(player: Player, selected: boolean) {
    if (draft.participants.some(p => p.playerId === player.id)) { participant(player.id, { vote: selected ? 'ATTENDING' : 'UNANSWERED' }); return }
    if (!selected) return
    if (draft.participants.length >= 200) { setError('한 경기 명단은 최대 200명입니다.'); return }
    change({ ...draft, participants: [...draft.participants, { playerId: player.id, name: player.name, shirtNumber: player.shirtNumber, birthYear: player.birthYear, playerType: player.playerType, vote: 'ATTENDING', attendance: 'UNCONFIRMED' }] })
  }
  function addGuest(player: Player) {
    setPlayers(previous => previous.some(p => p.id === player.id) ? previous : [...previous, player])
    selectAttendee(player, true)
  }
  async function savePlanAsActual() {
    if (!editable || submitting.current) return
    try { await persist(actualFromPlan(draft), 'actual-from-plan') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '계획과 출석을 확인해 주세요.') }
  }
  function appearance(slot: Slot, order: 0 | 1, patch: Partial<Appearance> | null) {
    const previous = teamLineup.find(a => a.slot === slot && a.entryOrder === order)
    if (patch?.playerId && q.lineup.some(a => a.playerId === patch.playerId && (a.team !== team || a.slot !== slot || a.entryOrder !== order))) {
      setError('같은 쿼터에 이미 배치된 선수입니다. 기존 자리에서 먼저 해제해 주세요.'); return
    }
    if (!patch && order === 0 && teamLineup.some(a => a.slot === slot && a.entryOrder === 1)) {
      setError('이 자리에는 교체 선수가 있습니다. 교체 기록을 먼저 확인하고 해제한 뒤 선발을 지워 주세요.'); return
    }
    if ((!patch || (patch.playerId && patch.playerId !== previous?.playerId)) && previous && (previous.goals || previous.assists)) {
      setError('이 자리에는 득점·도움 기록이 있습니다. 선수 변경 전에 기록을 확인하고 0으로 정정해 주세요.'); return
    }
    const rest = q.lineup.filter(a => a.team !== team || a.slot !== slot || a.entryOrder !== order)
    const lineup = patch ? [...rest, { team, slot, entryOrder: order, playerId: 0, goals: 0, assists: 0, ...previous, ...patch }] : rest
    setError(''); change({ ...draft, quarters: draft.quarters.map(item => item.number === quarter ? { ...item, lineup } : item) })
  }
  function applyWorkbook(preview: MatchImportPreview) {
    if (!preview.valid) return false
    const quarters = draft.quarters.map(q => ({ ...q, lineup: [
      ...q.lineup.filter(a => a.team !== team), ...preview.quarters.find(row => row.number === q.number)!.lineup.map(a => ({ ...a, team })),
    ] }))
    if (quarters.some(q => new Set(q.lineup.map(a => a.playerId)).size !== q.lineup.length)) {
      setError('엑셀에 같은 쿼터의 다른 팀에 배치된 선수가 있습니다. 해당 팀 배치를 먼저 확인해 주세요.'); return false
    }
    const participants = [...draft.participants]
    for (const row of preview.rows) if (row.playerId !== null && !participants.some(p => p.playerId === row.playerId)) {
      participants.push({ playerId: row.playerId, name: row.name!, shirtNumber: row.shirtNumber, birthYear: row.birthYear, playerType: row.playerType ?? 'MEMBER', vote: 'UNANSWERED', attendance: 'UNCONFIRMED' })
    }
    if (participants.length > 200) { setError('경기 참가 명단은 최대 200명입니다. 엑셀의 선수를 확인해 주세요.'); return false }
    change({ ...draft, participants, quarters }); setError(''); setQuarter(1); return true
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const destination = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value || 'finish'
    await persist(draft, destination)
  }
  async function persist(next: MatchDraft, destination: string) {
    if (submitting.current || busy || blocked || !isAdmin) return
    if (!next.playedOn || Number(next.playedOn.slice(0, 4)) < 1000) { setError('경기 날짜를 입력해 주세요.'); return }
    if (!validKickoff(next.kickoff)) { setError('시작 시와 분을 모두 선택해 주세요. 분은 00분 또는 30분만 선택할 수 있습니다.'); return }
    if ((next.scoreFor === null) !== (next.scoreAgainst === null) || [next.scoreFor, next.scoreAgainst].some(score => score !== null && (!Number.isInteger(score) || score < 0 || score > 99))) {
      goToStep('match-totals'); setError('스코어는 양쪽 모두 0~99로 입력하거나 모두 비워 주세요.'); return
    }
    for (const item of next.quarters) {
      if (item.lineup.some(a => [a.goals, a.assists].some(n => !Number.isInteger(n) || n < 0 || n > 99))) {
        setQuarter(item.number); goToStep('lineup-title'); setError(`${item.number}쿼터의 득점·도움은 0~99 정수로 입력해 주세요.`); return
      }
      if (item.lineup.some(a => !next.participants.some(p => p.playerId === a.playerId && canPlay(p)))) {
        goToStep('attendance-title'); setError('출전 선수의 실제 출석을 참석 또는 지각으로 확인한 뒤 저장해 주세요. 엑셀 업로드는 출석을 자동 변경하지 않습니다.'); return
      }
      for (const value of ['A', 'B'] as const) {
        const lineup = item.lineup.filter(a => a.team === value)
        if (lineup.reduce((sum, a) => sum + a.assists, 0) > lineup.reduce((sum, a) => sum + a.goals, 0)) {
          setQuarter(item.number); setTeam(value); goToStep('lineup-title'); setError(`${item.number}쿼터 ${internal ? `${value}팀의 ` : ''}도움 합계가 득점 합계보다 많습니다. 득점도 함께 입력해 주세요.`); return
        }
      }
    }
    submitting.current = true; setBusy(true); setError('')
    try {
      const saved = await saveMatch(next, record)
      setRecord(saved); setDraft(saved); setDirty(false); setConfirmClose(false)
      if (destination === 'finish') onSaved(saved)
      else {
        onStepSaved(destination === 'lineup' ? '스쿼드 계획을 저장했습니다.' : destination === 'actual-from-plan' ? '계획대로 참석·출전 기록을 저장했습니다.' : '실제 출전 기록을 저장했습니다.')
        if (destination === 'actual-from-plan') setQuarter(1)
        goToStep(destination === 'lineup' || destination === 'actual-from-plan' ? 'lineup-title' : 'match-totals')
      }
    }
    catch (cause) {
      if (cause instanceof SessionExpiredError) { onSessionExpired(); return }
      if (cause instanceof MatchRequestError && cause.status < 500) {
        setError(cause.message); if (cause.status === 409 || cause.status === 404) setBlocked(true)
      } else {
        setError('저장 결과를 확인하지 못했습니다. 중복 등록을 막기 위해 재전송을 멈췄습니다. 입력 내용을 보관하고 목록에서 저장 여부를 확인해 주세요.'); setBlocked(true)
      }
    } finally { setBusy(false); submitting.current = false }
  }
  const totals = draft.participants.map(p => {
    const appearances = draft.quarters.flatMap(q => q.lineup.filter(a => a.playerId === p.playerId).map(a => ({ ...a, quarter: q.number, share: quarterShare(q, a) })))
    return { ...p, appearances, credited: appearances.reduce((s, a) => s + a.share, 0), goals: appearances.reduce((s, a) => s + a.goals, 0), assists: appearances.reduce((s, a) => s + a.assists, 0) }
  })
  function stepActions(destination: 'lineup' | 'totals') {
    const label = destination === 'lineup' ? '계획 저장 · 실제 기록으로' : '출전 기록 저장 · 집계 확인'
    return <div className="match-step-actions">
      <p className="field-help">{isAdmin ? '현재 입력한 경기 내용 전체를 저장하고 다음 단계로 이동합니다.' : '다음 단계의 기록을 확인하세요.'}</p>
      {isAdmin ? <button type="submit" value={destination} className="primary-button" disabled={!editable}>{busy ? '처리 중…' : label}</button>
        : <button type="button" className="secondary-button" onClick={() => goToStep(destination === 'lineup' ? 'lineup-title' : 'match-totals')}>{destination === 'lineup' ? '실제 기록 보기' : '집계 보기'}</button>}
    </div>
  }
  const enteredGoals = (value: MatchTeam) => draft.quarters.flatMap(q => q.lineup).filter(a => a.team === value).reduce((sum, a) => sum + a.goals, 0)
  return <form className="match-editor" noValidate onSubmit={submit} aria-busy={busy}>
    <div className="match-editor-heading"><div><p className="eyebrow muted">{record ? 'MATCH RECORD' : 'NEW MATCH'}</p><h3 id="match-editor-title">{record ? `${record.playedOn} 경기 기록` : '새 경기 기록'}</h3></div>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => dirty ? setConfirmClose(true) : onClose()}>목록으로</button></div>
    {confirmClose && <div className="conflict-notice"><p>저장하지 않은 입력이 있습니다. 목록으로 돌아가면 이 입력은 사라집니다.</p><div className="registration-actions"><button type="button" className="secondary-button" onClick={onClose}>입력 취소하고 목록으로</button><button type="button" className="secondary-button" onClick={() => setConfirmClose(false)}>계속 작성</button></div></div>}
    <fieldset disabled={!editable} className="player-fields match-basics"><legend className="sr-only">경기 기본 정보</legend>
      <div className="match-kind-field"><label htmlFor="match-kind">경기 유형</label><select id="match-kind" value={draft.kind} disabled={kindLocked} onChange={e => { change({ ...draft, kind: e.target.value as MatchKind, opponent: '' }); setTeam('A') }}><option value="EXTERNAL">외부 경기</option><option value="INTERNAL">자체전 · A팀 vs B팀</option></select>
        <small className="match-time-help">{kindLocked ? '배치·스코어 입력 후 또는 저장 후에는 유형을 변경할 수 없습니다.' : '하루 4쿼터 전체에 적용됩니다.'}</small></div>
      <div><label htmlFor="match-date">경기 날짜 <span>필수</span></label><input id="match-date" type="date" required min="1000-01-01" max="9999-12-31" value={draft.playedOn} onChange={e => change({ ...draft, playedOn: e.target.value })} /></div>
      <div><label id="match-time-label" htmlFor="match-hour">시작 시간 <span>필수 · 30분 단위</span></label>
        <div className="match-time-selects" role="group" aria-labelledby="match-time-label">
          <select id="match-hour" aria-label="시작 시" aria-describedby="match-time-help" required value={kickoffHour} onChange={e => changeKickoff(e.target.value, kickoffMinute)}>
            <option value="">시 선택</option>{kickoffHours.map(hour => <option key={hour} value={hour}>{hour}시</option>)}
          </select><span aria-hidden="true">:</span>
          <select id="match-minute" aria-label="시작 분" aria-describedby="match-time-help" required value={kickoffMinute} onChange={e => changeKickoff(kickoffHour, e.target.value)}>
            <option value="">분 선택</option>{kickoffMinutes.map(minute => <option key={minute} value={minute}>{minute}분</option>)}
          </select>
        </div><small id="match-time-help" className="match-time-help">{validKickoff(draft.kickoff) ? matchTimeRange(draft.kickoff) : draft.kickoff ? `기존 ${draft.kickoff.slice(0, 5)} · 30분 단위로 다시 선택` : '시작 시간 + 2시간으로 표시'}</small></div>
      {!internal && <div><label htmlFor="match-opponent">상대 팀 <span>선택</span></label><input id="match-opponent" maxLength={100} value={draft.opponent} onChange={e => change({ ...draft, opponent: e.target.value })} placeholder="상대 팀 이름" /></div>}
      <div><label htmlFor="match-venue">장소 <span>선택</span></label><input id="match-venue" maxLength={100} value={draft.venue} onChange={e => change({ ...draft, venue: e.target.value })} placeholder="경기장 이름" /></div>
    </fieldset>
    {error && <p ref={errorMessage} tabIndex={-1} className="form-error match-error" role="alert">{error}</p>}
    <div className="match-step-tabs" id="match-step-tabs" role="tablist" aria-label="경기 기록 입력 단계">{editorSteps.map((label, index) =>
      <button key={label} type="button" role="tab" id={`match-tab-${index}`} aria-selected={step === index} aria-controls={`match-panel-${index}`} disabled={busy}
        onClick={() => goToStep(stepHeadings[index])} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % 4 : event.key === 'ArrowLeft' ? (index + 3) % 4 : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : null
          if (next !== null) { event.preventDefault(); setStep(next); document.getElementById(`match-tab-${next}`)?.focus() }
        }} tabIndex={step === index ? 0 : -1}><span>0{index + 1}</span>{label}</button>)}
    </div>
    <div role="tabpanel" id="match-panel-0" aria-labelledby="match-tab-0" hidden={step !== 0}>
    <section className="match-block" aria-labelledby="attendance-title"><div className="match-block-title"><h4 id="attendance-title" tabIndex={-1}>01 · 투표와 실제 출석</h4><span>참석 예정 {draft.participants.filter(p => p.vote === 'ATTENDING').length}명 / 실제 참석 {eligible.length}명 (지각 포함)</span></div>
      <p className="field-help">카카오톡 투표를 직접 옮겨 적습니다. 투표 결과가 실제 출석으로 자동 처리되지는 않습니다. 연령대는 생일과 관계없이 경기 연도 {Number.isFinite(referenceYear) ? referenceYear : '미정'}년 − 생년으로 계산합니다.</p>
      <AttendeePicker players={players} participants={draft.participants} editable={editable} referenceYear={referenceYear} onSelect={selectAttendee} />
      {players.filter(p => p.playerType !== 'GUEST').length > 200 && !record && <p className="import-warning">첫 200명을 명단에 넣었습니다. 한 경기 명단은 최대 200명입니다.</p>}
      {!draft.participants.length && <p className="save-notice">선수단에 선수를 등록한 뒤 이 경기를 다시 열면 명단에 추가할 수 있습니다. 경기 기본 정보만 먼저 저장해도 됩니다.</p>}
      {!!draft.participants.length && <details className="attendance-details"><summary>투표 상세·실제 출석 입력 펼치기</summary><div className="match-table-scroll"><table className="match-table"><thead><tr><th scope="col">선수</th><th scope="col">참불 투표</th><th scope="col">실제 출석</th></tr></thead>
        <tbody>{draft.participants.map(p => <tr key={p.playerId}><th scope="row">{p.playerType === 'GUEST' && '용병 · '}{p.name}<small>{shirtLabel(p.shirtNumber)}</small><small>{ageDescription(p.birthYear, referenceYear)}</small></th>
          <td>{isAdmin ? <select disabled={!editable} aria-label={`${playerLabel(p)} 투표`} value={p.vote} onChange={e => participant(p.playerId, { vote: e.target.value as Vote })}>{Object.entries(voteLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select> : voteLabels[p.vote]}</td>
          <td>{isAdmin ? <select disabled={!editable} aria-label={`${playerLabel(p)} 출석`} value={p.attendance} onChange={e => participant(p.playerId, { attendance: e.target.value as Attendance })}>{Object.entries(attendanceLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select> : attendanceLabels[p.attendance]}</td>
        </tr>)}</tbody></table></div></details>}
      {isAdmin && missingPlayers.length > 0 && draft.participants.length < 200 && <div className="import-tools"><label className="upload-label">경기 명단에 선수 추가<select disabled={!editable} value={addedPlayer} onChange={e => setAddedPlayer(e.target.value)}><option value="">선수 선택</option>{missingPlayers.map(p => <option key={p.id} value={p.id}>{playerLabel(p)}</option>)}</select></label>
        <button type="button" disabled={!editable || !addedPlayer} className="secondary-button" onClick={() => {
          const p = players.find(p => p.id === Number(addedPlayer))!
          change({ ...draft, participants: [...draft.participants, { playerId: p.id, name: p.name, shirtNumber: p.shirtNumber, birthYear: p.birthYear, playerType: p.playerType, vote: 'UNANSWERED', attendance: 'UNCONFIRMED' }] }); setAddedPlayer('')
        }}>명단에 추가</button></div>}
    </section>
    <div className="match-step-actions"><p className="field-help">입력은 탭을 옮겨도 유지됩니다. 저장 버튼을 누르면 DB에 반영됩니다.</p><button type="button" className="secondary-button" disabled={busy} onClick={() => goToStep('plan-title')}>02 스쿼드 계획으로</button></div>
    </div>
    <div role="tabpanel" id="match-panel-1" aria-labelledby="match-tab-1" hidden={step !== 1}>
    {isAdmin && !internal && <AutomaticLineup draft={draft} players={players} matchId={record?.id ?? null} disabled={!editable} onBusy={setBusy} onSessionExpired={onSessionExpired}
      onApply={plannedLineup => { change({ ...draft, plannedLineup }); setPlanRevision(v => v + 1); setError('') }} />}
    <MatchPlanner key={`${draft.kind}-${planRevision}`} internal={internal} entries={draft.plannedLineup} participants={draft.participants} players={players} editable={editable} referenceYear={referenceYear}
      onChange={plannedLineup => { change({ ...draft, plannedLineup }); setError('') }} footer={stepActions('lineup')}
      tools={isAdmin && <GuestPicker players={players} selectedIds={draft.participants.filter(p => p.vote === 'ATTENDING').map(p => p.playerId)} disabled={!editable || draft.participants.length >= 200} onBusy={setBusy} onAdd={addGuest} onSessionExpired={onSessionExpired} />} />
    </div>
    <div role="tabpanel" id="match-panel-2" aria-labelledby="match-tab-2" hidden={step !== 2}>
    <section className="match-block" aria-labelledby="lineup-title"><div className="match-block-title"><h4 id="lineup-title" tabIndex={-1}>03 · 쿼터별 실제 출전 기록</h4><span>{internal ? 'A팀·B팀 각각 ' : ''}4-1-2-3 고정 · 직접 배치</span></div>
      {isAdmin && <div className="plan-actual-start"><p><strong>참석 예정자가 계획대로 참여했다면</strong><br />02의 현재 1~4쿼터 배치를 실제 출전 기록으로 저장합니다. 참석 예정자 중 미확인 출석은 참석으로 바꾸며, 지각·불참은 유지합니다. 현재 입력 내용 전체를 함께 저장합니다.</p>
        <button type="button" className="primary-button" disabled={!editable || !draft.plannedLineup.length || draft.quarters.some(q => q.lineup.length > 0)} onClick={() => void savePlanAsActual()}>02 계획대로 참석·출전 기록 저장</button>
        <p className="field-help">{draft.quarters.some(q => q.lineup.length) ? '이미 실제 출전 기록이 있어 일괄 복사를 막았습니다. 아래에서 직접 수정하세요.' : !draft.plannedLineup.length ? '02에서 계획 스쿼드를 먼저 배치해 주세요.' : '계획에 실제 불참으로 기록한 선수가 있으면 저장을 멈춥니다. 달라진 인원은 먼저 확인해 주세요. 골·도움은 0으로 시작합니다.'}</p>
      </div>}
      <p className="field-help">11개 자리마다 선발 1명과 교체 1명을 기록합니다. 교체한 두 선수는 각각 0.5쿼터, 교체 없는 선발은 1쿼터입니다. 교체 시각·쿼터 길이는 저장하지 않으며 같은 쿼터의 재투입·포지션 이동은 지원하지 않습니다.</p>
      {draft.quarters.some(item => item.lineup.some(a => !draft.participants.some(p => p.playerId === a.playerId && canPlay(p)))) && <p className="import-warning">출전 명단에 실제 출석이 미확인 또는 불참인 선수가 있습니다. 위 출석표에서 확인해 주세요.</p>}
      <div className="quarter-tabs" role="group" aria-label="쿼터 선택">{draft.quarters.map(item => {
        const lineup = item.lineup.filter(a => a.team === team)
        const substitutions = lineup.filter(a => a.entryOrder === 1).length
        return <button type="button" key={item.number} aria-pressed={quarter === item.number} onClick={() => setQuarter(item.number)}>{item.number}쿼터 <small>{internal && `${team}팀 `}선발 {lineup.filter(a => a.entryOrder === 0).length}/11{substitutions > 0 && ` · 교체 ${substitutions}`}</small></button>
      })}</div>
      {internal && <TeamSelector label="실제 출전 팀" team={team} onChange={setTeam} disabled={busy} counts={{ A: q.lineup.filter(a => a.team === 'A').length, B: q.lineup.filter(a => a.team === 'B').length }} />}
      {isAdmin && <MatchWorkbookImport key={`${draft.kind}-${team}`} teamLabel={internal ? `${team}팀` : undefined} disabled={!editable} onBusy={setBusy} onApply={applyWorkbook} onSessionExpired={onSessionExpired} />}
      <div className="quarter-summary"><strong>{quarter}쿼터 {internal && `${team}팀`} · 득점 {teamLineup.reduce((s, a) => s + a.goals, 0)} / 도움 {teamLineup.reduce((s, a) => s + a.assists, 0)}</strong>
        <span>기록 인원 {teamLineup.length}명</span></div>
      <div className={`lineup-pitch${internal ? ` team-pitch-${team.toLowerCase()}` : ''}`} aria-label={`${quarter}쿼터 ${internal ? `${team}팀 ` : ''}4-1-2-3 출전 명단`}><p className="attack-direction">{internal && `${team}팀 · `}공격 방향 ↑</p>{pitchRows.map((row, i) => <div className="lineup-row" key={i}>{row.map(slot =>
        <LineupPosition key={`${quarter}-${team}-${slot}`} team={team} internal={internal} slot={slot} quarter={q} participants={draft.participants} referenceYear={referenceYear} isAdmin={isAdmin} editable={editable} onChange={appearance} />
      )}</div>)}</div>
      <p className="field-help">이번 쿼터에 배치되지 않은 참석자: {eligible.filter(p => !q.lineup.some(a => a.playerId === p.playerId)).map(playerLabel).join(', ') || '없음'}</p>
      {stepActions('totals')}
    </section>
    </div>
    <div role="tabpanel" id="match-panel-3" aria-labelledby="match-tab-3" hidden={step !== 3}>
    <section className="match-block" aria-labelledby="match-totals"><div className="match-block-title"><h4 id="match-totals" tabIndex={-1}>04 · 경기 결과와 코멘트</h4><span>4쿼터 합계 · 계획 스쿼드는 제외</span></div>
      <fieldset className="match-score-fields" disabled={!editable}><legend>최종 스코어 <span>4쿼터 합계 · 선택 · 경기 전에는 비워 두세요</span></legend>
        <label>{internal ? 'A팀 득점' : '우리 팀 득점'}<input type="number" min={0} max={99} step={1} value={draft.scoreFor ?? ''} placeholder="미입력" onChange={e => change({ ...draft, scoreFor: e.target.value === '' ? null : Number(e.target.value) })} /></label><span aria-hidden="true">:</span>
        <label>{internal ? 'B팀 득점' : '상대 팀 득점'}<input type="number" min={0} max={99} step={1} value={draft.scoreAgainst ?? ''} placeholder="미입력" onChange={e => change({ ...draft, scoreAgainst: e.target.value === '' ? null : Number(e.target.value) })} /></label>
      </fieldset>
      {(['A', ...(internal ? ['B'] : [])] as MatchTeam[]).map(value => {
        const score = value === 'A' ? draft.scoreFor : draft.scoreAgainst
        return score !== null && score !== enteredGoals(value) && <p key={value} className="import-warning" role="status">{internal ? `${value}팀` : '우리 팀'} 스코어 {score}골과 해당 팀 선수별 득점 합계 {enteredGoals(value)}골이 다릅니다. 득점자 미입력·자책골 등이 있는지 확인해 주세요. 이 상태로도 저장할 수 있습니다.</p>
      })}
      <label className="match-notes" htmlFor="match-notes">경기 후 코멘트 <span>선택 · 최대 3,000자</span><textarea id="match-notes" rows={3} maxLength={3000} disabled={!editable} value={draft.notes} onChange={e => change({ ...draft, notes: e.target.value })} placeholder="경기 흐름, 기억할 장면, 다음 경기를 위한 메모를 남겨 주세요." /></label>
      <h5>선수별 실제 기록 집계</h5>
      <div className="match-table-scroll"><table className="match-table"><thead><tr><th scope="col">선수</th><th scope="col">출석</th><th scope="col">출전 쿼터</th><th scope="col">득점</th><th scope="col">도움</th></tr></thead><tbody>
        {totals.map(p => <tr key={p.playerId}><th scope="row">{p.playerType === 'GUEST' && '용병 · '}{p.name}<small>{shirtLabel(p.shirtNumber)} · {ageBand(p.birthYear, referenceYear)}</small></th><td>{attendanceLabels[p.attendance]}</td><td>{p.appearances.length ? <>{p.appearances.map(a => `${a.quarter}Q${internal ? ` ${a.team}팀` : ''}(${a.share})`).join(' · ')}<small>합계 {p.credited}쿼터</small></> : '출전 기록 없음'}</td><td>{p.goals}</td><td>{p.assists}</td></tr>)}
      </tbody></table></div>
    </section>
    </div>
    {isAdmin && <div className="match-save-bar"><span>{dirty ? '저장하지 않은 변경 사항이 있습니다.' : '투표만 먼저 저장해도 됩니다. 나머지 기록은 나중에 수정하세요.'}</span><button type="submit" className="primary-button" disabled={busy || blocked}>{busy ? '처리 중…' : '경기 기록 저장'}</button></div>}
  </form>
}
