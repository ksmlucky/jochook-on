import { useEffect, useId, useRef, useState } from 'react'
import type { Player } from '../players/api'
import type { MatchDraft, MatchTeam } from './api'
import { playerLabel } from './api'
import { assignPlannedTeam, internalTeamCandidates, plannedTeamPlayers, setInternalTeamSelection, teamChangeRemovesPlan, unassignedAttendees } from './internalTeams'
import './internal-teams.css'

type SelectionAction = { playerId: number; team: MatchTeam; kind: 'select' | 'remove' | 'move' }

export function InternalTeamAssignment({ draft, players, editable, onChange }: {
  draft: MatchDraft; players: Player[]; editable: boolean; onChange: (draft: MatchDraft) => void
}) {
  const titleId = useId()
  const [team, setTeam] = useState<MatchTeam>('A')
  const [search, setSearch] = useState('')
  const [onlySelected, setOnlySelected] = useState(false)
  const [confirmation, setConfirmation] = useState<SelectionAction | null>(null)
  const confirmationPanel = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const roster = internalTeamCandidates(players, draft.participants)
  const membership = (id: number) => draft.participants.find(p => p.playerId === id)
  const candidates = roster.filter(p => `${p.name} ${p.shirtNumber ?? ''}`.includes(search.trim()) &&
    (!onlySelected || membership(p.playerId)?.vote === 'ATTENDING' && membership(p.playerId)?.plannedTeam === team))
  const pendingPlayer = roster.find(p => p.playerId === confirmation?.playerId)
  const unassigned = unassignedAttendees(draft.participants)

  useEffect(() => {
    if (!confirmation) return
    confirmationPanel.current?.focus({ preventScroll: true })
    confirmationPanel.current?.scrollIntoView({ block: 'nearest' })
  }, [confirmation])

  function apply(action: SelectionAction, confirmed = false) {
    if (!editable) return
    const candidate = roster.find(p => p.playerId === action.playerId)
    if (!candidate) { setConfirmation(null); return }
    const nextTeam = action.kind === 'remove' ? null : action.team
    if (!confirmed && (action.kind === 'move' || teamChangeRemovesPlan(draft, action.playerId, nextTeam))) {
      setConfirmation(action); setError(''); return
    }
    try {
      onChange(action.kind === 'move'
        ? assignPlannedTeam(draft, action.playerId, action.team)
        : setInternalTeamSelection(draft, candidate, action.team, action.kind === 'select'))
      setConfirmation(null); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '팀 선택을 확인해 주세요.') }
  }

  return <section className="internal-team-assignment" aria-labelledby={titleId}>
    <div className="match-block-title"><h5 id={titleId}>자체전 A·B팀 선수 선택</h5>
      <span className="internal-team-counts"><span>참석 예정 {draft.participants.filter(p => p.vote === 'ATTENDING').length}명</span><span>미배정 {unassigned.length}명</span></span>
    </div>
    <p className="field-help">팀을 고르고 선수를 체크하세요. 참석 예정과 팀이 함께 등록되고, 02에서도 정한 팀 안에서 편성해요.</p>
    <div className="internal-team-tabs" role="group" aria-label="선택할 자체전 팀">
      {(['A', 'B'] as const).map(value => <button type="button" key={value} className={`internal-team-tab team-${value.toLowerCase()}`} aria-pressed={team === value}
        onClick={() => { setTeam(value); setConfirmation(null); setError('') }}>
        <strong>{value}팀</strong><span>{plannedTeamPlayers(draft.participants, value).length}명</span>
      </button>)}
    </div>
    <p className="internal-team-selection-hint" aria-live="polite">지금 <strong>{team}팀</strong> 선수를 {editable ? '선택하고 있어요.' : '보고 있어요.'}</p>
    <div className="internal-team-tools"><label>선수 검색<input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름 또는 등번호" /></label>
      <label className="inline-check"><input type="checkbox" checked={onlySelected} onChange={e => setOnlySelected(e.target.checked)} />{team}팀 선수만 보기</label>
    </div>
    <div className="internal-team-grid">{candidates.map(p => {
      const participant = membership(p.playerId)
      const assignedTeam = participant?.vote === 'ATTENDING' ? participant.plannedTeam : null
      const selected = assignedTeam === team
      const otherTeam = assignedTeam && assignedTeam !== team ? assignedTeam : null
      return <div key={p.playerId} className={`internal-team-card team-${assignedTeam?.toLowerCase() ?? 'unassigned'}${selected ? ' is-selected' : ''}${otherTeam ? ' is-other-team' : ''}`}>
        <label className="internal-team-choice">
          <input type="checkbox" checked={selected} disabled={!editable || !!otherTeam}
            aria-label={`${playerLabel(p)} ${team}팀 참석 예정${otherTeam ? ` · ${otherTeam}팀에 이미 배정됨` : ''}`}
            onChange={e => apply({ playerId: p.playerId, team, kind: e.target.checked ? 'select' : 'remove' })} />
          <strong><small>{p.shirtNumber === null ? p.playerType === 'GUEST' ? '용병' : '번호 없음' : `#${p.shirtNumber}`}</small><span>{p.name}</span></strong>
          <span className="internal-team-preferences">{p.preferences.join('/') || '포지션 미확인'}</span>
          <span className="internal-team-membership">{assignedTeam ? `${assignedTeam}팀${selected ? ' 선택됨' : ' 배정됨'}` : participant?.vote === 'ATTENDING' ? '참석 · 미배정' : '미선택'}</span>
          {p.playerType === 'GUEST' && p.shirtNumber !== null && <small className="internal-team-existing">용병</small>}
          {p.existingOnly && p.playerType !== 'GUEST' && <small className="internal-team-existing">기존 참가자</small>}
        </label>
        {otherTeam && <button type="button" className="internal-team-move" disabled={!editable}
          aria-label={`${playerLabel(p)} ${otherTeam}팀에서 ${team}팀으로 이동`} onClick={() => apply({ playerId: p.playerId, team, kind: 'move' })}>{team}팀으로 이동</button>}
      </div>
    })}</div>
    {!candidates.length && <p className="field-help">조건에 맞는 선수가 없어요.</p>}
    <p className="field-help">체크를 해제하면 미투표로 돌아가요. 선택 해제 시 배치도 정리돼요. 골·도움 기록이 있으면 먼저 정정해야 해요.</p>
    {unassigned.length > 0 && <p className="field-help">참석 예정 중 미배정 선수가 {unassigned.length}명 있어요. 팀을 골라 체크해 주세요. 중간 저장은 할 수 있어요.</p>}
    {confirmation && pendingPlayer && <div className="conflict-notice" role="alert" tabIndex={-1} ref={confirmationPanel}>
      <p><strong>{playerLabel(pendingPlayer)}</strong> 선수를 {confirmation.kind === 'remove' ? `${confirmation.team}팀에서 선택 해제하고 미투표로 변경` : `${confirmation.team}팀으로 ${confirmation.kind === 'move' ? '이동' : '배정'}`}할까요?</p>
      {teamChangeRemovesPlan(draft, confirmation.playerId, confirmation.kind === 'remove' ? null : confirmation.team) && <p>이 선수의 기존 팀 배치가 해제돼요. 같은 자리의 교체 선수는 선발로 올라가요.</p>}
      <p>선택 해제 시 배치도 정리돼요. 골·도움 기록이 있으면 먼저 정정해야 해요.</p>
      <div className="registration-actions"><button type="button" className="primary-button" disabled={!editable} onClick={() => apply(confirmation, true)}>{confirmation.kind === 'remove' ? '선택 해제 · 배치 정리' : '팀 배정 변경'}</button>
        <button type="button" className="secondary-button" onClick={() => setConfirmation(null)}>취소</button></div>
    </div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>
}
