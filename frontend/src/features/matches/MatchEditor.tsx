import { unifiedDraft, squadPlanningView, applySquad, editSquad, updateSquadParticipant, applySquadTeamSelection } from './unifiedSquad'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { SessionExpiredError } from '../auth/api'
import type { Player } from '../players/api'
import { attendanceLabels, canPlay, emptyMatch, fetchMatch, fetchSaveReceipt, MatchRequestError, playerLabel, quarterShare, saveMatch, shirtLabel, voteLabels } from './api'
import type { Appearance, Attendance, MatchDraft, MatchKind, MatchRecord, MatchTeam, Participant, Slot, Vote } from './api'
import { ageBand, ageDescription } from '../players/age'
import { AttendeePicker } from './AttendeePicker'
import { MatchPlanner } from './MatchPlanner'
import { SquadImageShare } from './SquadImageShare'
import { MatchResultGoals } from './MatchResultGoals'
import { AutomaticLineup } from './AutomaticLineup'
import { GuestPicker } from './GuestPicker'
import { kickoffHours, kickoffMinutes, matchTimeRange, validKickoff } from './time'
import { useEditGuard } from '../../app/LeaveGuard'
import { RecordingStatus } from './RecordingStatus'
import { recordingStageLabel, resumeStep, stageOnSave } from './recordingProgress'
import { FormationSelector } from './FormationSelector'
import { goalBreakdownError, goalBreakdownText, sumGoalBreakdown } from './goalBreakdown'
import { clearMatchRecovery, saveMatchRecovery } from './draftRecovery'
import type { DraftOwner, PendingMatchSave, RecoverySnapshot } from './draftRecovery'
import { pendingSaveFailureDisposition, resolvePendingSave, SaveResultChangedError } from './saveRecoveryFlow'
import type { SaveAttemptKind } from './saveRecoveryFlow'
import { DraftRetentionHelp } from './DraftRetentionHelp'
import './match-recovery.css'
import { TournamentPicker } from '../tournaments/TournamentPicker'
import { fetchTournament } from '../tournaments/api'
import type { Tournament } from '../tournaments/api'
import { outsideTournamentDates, tournamentStageLabels } from './tournamentFields'
import type { TournamentStage } from './tournamentFields'
import { MatchCategoryBadge } from './MatchCategoryBadge'
import { competitionCategory } from './competitionCategory'
import { CompletionReview } from './MatchCompletionReview'
import type { CompletionReviewTarget } from './completionReview'
import { InternalTeamAssignment } from './InternalTeamAssignment'
import { checkInternalPlanTeams } from './internalTeams'
import { currentDraftSlot, legacyDraftEntries, upgradeEditableMatchDraft } from './legacyMatchDraft'
import { changeMatchFormat, matchPeriodSummary, normalizeMatchFormat, quarterLabel, quarterNumbers, validateMatchPeriods } from './matchFormat'
import type { MatchFormat } from './matchFormat'
import './match-editor-basics.css'

const editorSteps = ['참석 명단', '스쿼드·기록', '스쿼드·기록', '결과·코멘트']
const visibleSteps = [0, 1, 3]
const visibleStep = (value: number) => value === 2 ? 1 : value
const stepHeadings = ['attendance-title', 'plan-title', 'plan-title', 'match-totals']

export function MatchEditor({ record: initialRecord, players: initialPlayers, isAdmin, teamName, recoveryOwner, recovered, recoveryConflict = '', closeLabel = '목록으로', initialTournamentId = null, onSaved, onStepSaved, onClose, onSessionExpired }: {
  record: MatchRecord | null; players: Player[]; isAdmin: boolean; onSaved: (record: MatchRecord) => void; onStepSaved: (message: string) => void; onClose: () => void; onSessionExpired: () => void
  recoveryOwner: DraftOwner | null; recovered?: RecoverySnapshot; recoveryConflict?: string; closeLabel?: string; initialTournamentId?: number | null; teamName?: string
}) {
  // 단계 저장 이후에도 편집을 유지하며 다음 저장은 새 ID/version으로 갱신한다.
  const [record, setRecord] = useState(recovered?.record ?? initialRecord)
  const [basicsOpen, setBasicsOpen] = useState(!(recovered?.record ?? initialRecord))
  const [players, setPlayers] = useState(initialPlayers)
  const [draft, setDraft] = useState<MatchDraft>(() => {
    const newDraft = { ...emptyMatch(players), tournamentId: initialTournamentId }
    const initial = recovered?.draft ?? record ?? (initialTournamentId != null ? changeMatchFormat(newDraft, 'TWO_HALVES_30') : newDraft)
    return recovered?.pending ? initial : isAdmin ? unifiedDraft(upgradeEditableMatchDraft(initial)) : { ...upgradeEditableMatchDraft(initial), plannedLineup: [] }
  })
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [tournamentError, setTournamentError] = useState('')
  const [tournamentRevision, setTournamentRevision] = useState(0)
  const attendanceDetails = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const controller = new AbortController(); setSelectedTournament(null); setTournamentError('')
    if (draft.tournamentId == null) return () => controller.abort()
    fetchTournament(draft.tournamentId, controller.signal).then(value => { if (!controller.signal.aborted) setSelectedTournament(value) }).catch(cause => {
      if (controller.signal.aborted) return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else { setTournamentError('연결된 대회 정보를 불러오지 못했어요. 대회 선택은 유지돼요.'); setBasicsOpen(true) }
    })
    return () => controller.abort()
  }, [draft.tournamentId, tournamentRevision, onSessionExpired])
  // 한쪽만 선택한 상태도 유지하되, 두 값이 있어야 저장할 시간을 만든다.
  const [kickoffHour, setKickoffHour] = useState(() => recovered?.kickoffHour ?? (validKickoff(initialRecord?.kickoff ?? null) ? initialRecord!.kickoff!.slice(0, 2) : ''))
  const [kickoffMinute, setKickoffMinute] = useState(() => recovered?.kickoffMinute ?? (validKickoff(initialRecord?.kickoff ?? null) ? initialRecord!.kickoff!.slice(3, 5) : ''))
  const [quarter, updateQuarter] = useState(() => quarterNumbers(draft.matchFormat).includes(recovered?.quarter ?? 1) ? recovered?.quarter ?? 1 : 1)
  const [team, updateTeam] = useState<MatchTeam>(recovered?.team ?? 'A')
  const [step, updateStep] = useState(() => visibleStep(recovered?.step ?? resumeStep(initialRecord?.recordingStage)))
  const [dirty, setDirty] = useState(!!recovered)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(!!recoveryConflict)
  const [error, setError] = useState(recoveryConflict)
  const [pending, setPending] = useState<PendingMatchSave | null>(recovered?.pending ?? null)
  const [storageWarning, setStorageWarning] = useState('')
  useEditGuard(isAdmin && dirty, busy, !!recoveryOwner && !storageWarning)
  const [latestServer, setLatestServer] = useState<MatchRecord | null>(null)
  const [serverMissing, setServerMissing] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [addedPlayer, setAddedPlayer] = useState('')
  const [planRevision, setPlanRevision] = useState(0)
  const submitting = useRef(false)
  const needsRecovery = useRef(!!recovered)
  const snapshot = useRef<RecoverySnapshot | null>(recoveryOwner ? {
    schema: 1, owner: recoveryOwner, savedAt: Date.now(), record, draft, kickoffHour, kickoffMinute, quarter, team, step, pending,
  } : null)
  const errorMessage = useRef<HTMLParagraphElement>(null)
  const internal = draft.kind === 'INTERNAL'
  const planning = squadPlanningView(draft)
  const kindLocked = !!record || !!draft.plannedLineup.length || draft.quarters.some(q => q.lineup.length > 0 || q.goalsAgainst != null) || draft.scoreFor !== null || draft.scoreAgainst !== null
  const referenceYear = Number(draft.playedOn.slice(0, 4))
  const eligible = draft.participants.filter(canPlay)
  const editable = isAdmin && !busy && !blocked && !pending
  const missingPlayers = players.filter(p => p.playerType !== 'GUEST' && !draft.participants.some(a => a.playerId === p.id))
  useEffect(() => { if (error) errorMessage.current?.focus() }, [error])
  useEffect(() => { document.getElementById('match-editor-title')?.scrollIntoView({ block: 'start' }) }, [])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  function remember(patch: Partial<RecoverySnapshot>, markDirty = false): boolean {
    if (!snapshot.current || !isAdmin) return false
    snapshot.current = { ...snapshot.current, ...patch, savedAt: Date.now() }
    if (markDirty) needsRecovery.current = true
    if (!needsRecovery.current && !snapshot.current.pending) return true
    const stored = saveMatchRecovery(snapshot.current)
    setStorageWarning(stored ? '' : '초안을 보관하지 못했어요. 현재 화면을 새로고침하거나 닫으면 입력을 잃을 수 있어요.')
    return stored
  }
  function setQuarter(value: number) { updateQuarter(value); remember({ quarter: value }) }
  function setTeam(value: MatchTeam) { updateTeam(value); remember({ team: value }) }
  function setStep(value: number) { const next = visibleStep(value); updateStep(next); remember({ step: next }) }
  function change(next: MatchDraft) {
    if (!editable) return
    setDraft(next); setDirty(true); setConfirmClose(false); setError(''); remember({ draft: next }, true)
  }
  function changeFormat(value: MatchFormat) {
    if (!editable) return
    try { change(changeMatchFormat(draft, value, record)); setQuarter(1); setPlanRevision(previous => previous + 1) }
    catch (cause) { setError((cause as Error).message) }
  }
  function chooseTournament(id: number | null, item: Tournament | null) {
    setSelectedTournament(item)
    let next: MatchDraft = { ...draft, tournamentId: id, tournamentName: item?.name ?? null, tournamentStage: id === draft.tournamentId ? draft.tournamentStage : null, tournamentSelectionSpecified: true }
    let formatNotice = ''
    if (!record && id != null && draft.tournamentId == null) {
      try { next = changeMatchFormat(next, 'TWO_HALVES_30'); setQuarter(1); setPlanRevision(previous => previous + 1) }
      catch (cause) { formatNotice = `대회 연결은 반영했어요. ${(cause as Error).message}` }
    }
    change(next)
    if (formatNotice) setError(formatNotice)
  }
  function changeKickoff(hour: string, minute: string) {
    setKickoffHour(hour); setKickoffMinute(minute)
    remember({ kickoffHour: hour, kickoffMinute: minute })
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
  function reviewNavigate(target: CompletionReviewTarget) {
    if (target.quarter) setQuarter(target.quarter)
    if (target.team) setTeam(target.team)
    goToStep(stepHeadings[target.step])
    requestAnimationFrame(() => {
      let control: HTMLElement | null = null
      if (target.step === 0) {
        if (attendanceDetails.current) attendanceDetails.current.open = true
        control = target.playerId ? document.getElementById(`attendance-${target.playerId}`) : attendanceDetails.current
      } else if (target.step === 3) control = document.getElementById('match-score-for')
      control?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      control?.focus({ preventScroll: true })
    })
  }
  function participant(id: number, patch: Partial<Participant>) {
    try { change(updateSquadParticipant(draft, id, patch)) }
    catch (cause) { setError((cause as Error).message) }
  }
  function selectAttendee(player: Player, selected: boolean) {
    if (draft.participants.some(p => p.playerId === player.id)) { participant(player.id, { vote: selected ? 'ATTENDING' : 'UNANSWERED' }); return }
    if (!selected) return
    if (draft.participants.length >= 200) { setError('한 경기 명단은 최대 200명입니다.'); return }
    change({ ...draft, participants: [...draft.participants, { playerId: player.id, name: player.name, shirtNumber: player.shirtNumber, birthYear: player.birthYear, playerType: player.playerType, vote: 'ATTENDING', attendance: 'PRESENT', plannedTeam: null }] })
  }
  function addGuest(player: Player) {
    setPlayers(previous => previous.some(p => p.id === player.id) ? previous : [...previous, player])
    selectAttendee(player, true)
  }
  function appearanceAt(targetQuarter: number, targetTeam: MatchTeam, slot: Slot, order: 0 | 1, patch: Partial<Appearance> | null) {
    if (!editable) throw new Error('지금은 수정할 수 없습니다.')
    change(editSquad(draft, targetQuarter, targetTeam, slot, order, patch))
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const destination = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value || 'save'
    await persist(draft, destination)
  }
  async function persist(next: MatchDraft, destination: string) {
    if (submitting.current || busy || blocked || pending || !isAdmin) return
    try { validateMatchPeriods(next) } catch (cause) { setBasicsOpen(true); setError((cause as Error).message); return }
    if (!next.playedOn || Number(next.playedOn.slice(0, 4)) < 1000) { setBasicsOpen(true); setError('경기 날짜를 입력해 주세요.'); return }
    if (!validKickoff(next.kickoff)) { setBasicsOpen(true); setError('시작 시와 분을 모두 선택해 주세요. 분은 00분 또는 30분만 선택할 수 있습니다.'); return }
    if (next.kind === 'INTERNAL') {
      try { checkInternalPlanTeams(next.plannedLineup, next.participants) }
      catch (cause) { goToStep('attendance-title'); setError((cause as Error).message); return }
    }
    if ((next.scoreFor === null) !== (next.scoreAgainst === null) || [next.scoreFor, next.scoreAgainst].some(score => score !== null && (!Number.isInteger(score) || score < 0 || score > 99))) {
      goToStep('match-totals'); setError('스코어는 양쪽 모두 0~99로 입력하거나 모두 비워 주세요.'); return
    }
    for (const item of next.quarters) {
      if (item.goalsAgainst != null && (!Number.isInteger(item.goalsAgainst) || item.goalsAgainst < 0 || item.goalsAgainst > 99)) {
        setQuarter(item.number); goToStep('match-totals'); setError('쿼터 실점은 0~99 정수로 입력해 주세요.'); return
      }
      if (item.lineup.some(a => [a.goals, a.assists].some(n => !Number.isInteger(n) || n < 0 || n > 99))) {
        setQuarter(item.number); goToStep('match-totals'); setError(`${quarterLabel(item.number, next.matchFormat)}의 득점·도움은 0~99 정수로 입력해 주세요.`); return
      }
      const invalidBreakdown = item.lineup.find(a => goalBreakdownError(a))
      if (invalidBreakdown) {
        setQuarter(item.number); setTeam(invalidBreakdown.team); goToStep('match-totals')
        setError(`${quarterLabel(item.number, next.matchFormat)}: ${goalBreakdownError(invalidBreakdown)}`); return
      }
      if (item.lineup.some(a => !next.participants.some(p => p.playerId === a.playerId && canPlay(p)))) {
        goToStep('attendance-title'); setError('01 참석 명단에서 출전 선수의 참석 여부를 확인해 주세요.'); return
      }
      for (const value of ['A', 'B'] as const) {
        const lineup = item.lineup.filter(a => a.team === value)
        if (lineup.reduce((sum, a) => sum + a.assists, 0) > lineup.reduce((sum, a) => sum + a.goals, 0)) {
          setQuarter(item.number); setTeam(value); goToStep('match-totals'); setError(`${quarterLabel(item.number, next.matchFormat)} ${internal ? `${value}팀의 ` : ''}도움 합계가 득점 합계보다 많습니다. 득점도 함께 입력해 주세요.`); return
        }
      }
    }
    const request: PendingMatchSave = {
      key: crypto.randomUUID(), draft: structuredClone({ ...next, tournamentSelectionSpecified: true, tournamentId: next.tournamentId ?? null, tournamentStage: next.tournamentStage ?? null, recordingStage: stageOnSave(step, destination) }),
      record: record ? structuredClone(record) : null, destination,
    }
    // Keep the exact request before it can reach the server. A lost response must not create a new key.
    if (!remember({ pending: request, draft: request.draft }, true)) {
      remember({ pending: null }); setError('초안을 보관하지 못해 저장을 멈췄어요. 브라우저 저장 공간을 확인해 주세요.'); return
    }
    setPending(request); setDraft(request.draft); setDirty(true)
    submitting.current = true; setBusy(true); setError('')
    try {
      const saved = await saveMatch(request.draft, request.record, request.key)
      savedSuccessfully(saved, request.destination)
    }
    catch (cause) { saveFailed(cause) }
    finally { setBusy(false); submitting.current = false }
  }
  function savedSuccessfully(saved: MatchRecord, destination: string) {
    needsRecovery.current = false
    if (recoveryOwner) clearMatchRecovery(recoveryOwner)
    if (snapshot.current) snapshot.current = { ...snapshot.current, record: saved, draft: unifiedDraft(saved), pending: null, step: visibleStep(resumeStep(saved.recordingStage)) }
    setPending(null); setBlocked(false); setRecord(saved); setDraft(unifiedDraft(saved)); setDirty(false); setConfirmClose(false); setStorageWarning(''); setError('')
    if (/^quarter-[1-4]$/.test(destination)) { setStep(3); onStepSaved(`${quarterLabel(Number(destination.slice(-1)), saved.matchFormat)} 기록을 저장했어요.`); return }
    if (destination === 'save' || destination === 'complete') onSaved(saved)
    else {
      onStepSaved(destination === 'plan' ? '참석 명단을 저장했어요. 스쿼드를 배치해 주세요.' : destination === 'lineup' ? '스쿼드를 저장했어요. 같은 화면에서 기록을 수정할 수 있어요.' : destination === 'actual-from-plan' ? '계획대로 참석·출전 기록을 저장했습니다.' : '스쿼드·기록을 저장했어요. 경기 결과를 확인해 주세요.')
      if (destination === 'actual-from-plan') setQuarter(1)
      goToStep(stepHeadings[resumeStep(saved.recordingStage)])
    }
  }
  function saveFailed(cause: unknown, attempt: SaveAttemptKind = 'initial-save') {
    if (cause instanceof SessionExpiredError) { onSessionExpired(); return }
    const disposition = pendingSaveFailureDisposition(attempt, cause instanceof MatchRequestError ? cause.status : undefined)
    if (cause instanceof SaveResultChangedError || disposition === 'blocked') {
      setBlocked(true); setError(cause instanceof Error ? cause.message : '저장된 기록이 변경되었거나 삭제되었습니다.'); return
    }
    if (cause instanceof MatchRequestError && disposition === 'editable') {
      const editableDraft = unifiedDraft(upgradeEditableMatchDraft(draft))
      setDraft(editableDraft); setPending(null); remember({ pending: null, draft: editableDraft }); setError(cause.message); return
    }
    if (cause instanceof MatchRequestError && attempt === 'recovery') {
      setError(cause.status === 401 || cause.status === 403 ? '로그인 상태와 수정 권한을 확인한 뒤 다시 시도해 주세요.' : '저장 여부를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.'); return
    }
    setError('응답을 받지 못했어요. 아래 버튼으로 저장 여부를 확인해 주세요.')
  }
  async function retryPending() {
    if (!pending || submitting.current || busy || blocked || !isAdmin) return
    submitting.current = true; setBusy(true); setError('')
    try {
      const saved = await resolvePendingSave(pending, {
        receipt: fetchSaveReceipt, match: fetchMatch,
        save: request => saveMatch(request.draft, request.record, request.key),
      })
      savedSuccessfully(saved, pending.destination)
    } catch (cause) { saveFailed(cause, 'recovery') }
    finally { setBusy(false); submitting.current = false }
  }
  async function viewLatest() {
    if (busy || !isAdmin) return
    setBusy(true); setError(''); setServerMissing(false)
    try {
      const receipt = pending ? await fetchSaveReceipt(pending.key) : null
      const id = receipt?.matchId ?? record?.id
      if (!id || receipt && !receipt.exists) { setServerMissing(true); return }
      setLatestServer(await fetchMatch(id))
    } catch (cause) {
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else if (cause instanceof MatchRequestError && cause.status === 404) { setLatestServer(null); setServerMissing(true) }
      else setError('최신 기록을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.')
    } finally { setBusy(false) }
  }
  function discardRecovery() {
    if (busy || pending && !blocked) return
    needsRecovery.current = false
    if (recoveryOwner) clearMatchRecovery(recoveryOwner)
    onClose()
  }
  const totals = draft.participants.map(p => {
    const appearances = draft.quarters.flatMap(q => q.lineup.filter(a => a.playerId === p.playerId).map(a => ({ ...a, quarter: q.number, share: quarterShare(q, a) })))
    return { ...p, appearances, credited: appearances.reduce((s, a) => s + a.share, 0), goals: appearances.reduce((s, a) => s + a.goals, 0), assists: appearances.reduce((s, a) => s + a.assists, 0),
      freeKickGoals: appearances.reduce((s, a) => s + (a.freeKickGoals ?? 0), 0), penaltyGoals: appearances.reduce((s, a) => s + (a.penaltyGoals ?? 0), 0) }
  }).filter(player => player.appearances.length > 0)
  function stepActions(destination: 'plan' | 'totals') {
    return <div className="match-step-actions">
      <p className="field-help">{isAdmin ? '오른쪽 아래 저장 버튼으로 다음 단계로 이동해요.' : '다음 단계의 기록을 확인하세요.'}</p>
      {!isAdmin && <button type="button" className="secondary-button" onClick={() => goToStep(destination === 'plan' ? 'plan-title' : 'match-totals')}>{destination === 'plan' ? '스쿼드·기록 보기' : '집계 보기'}</button>}
    </div>
  }
  const enteredGoals = (value: MatchTeam) => draft.quarters.flatMap(q => q.lineup).filter(a => a.team === value).reduce((sum, a) => sum + a.goals, 0)
  const errorNotice = error && <p ref={errorMessage} tabIndex={-1} className="form-error match-error" role="alert">{error}</p>
  return <form className={`match-editor${isAdmin ? ' has-save-dock' : ''}`} noValidate onSubmit={submit} aria-busy={busy}>
    <div className="match-editor-heading"><div><p className="eyebrow muted">{record ? 'MATCH RECORD' : 'NEW MATCH'}</p><h3 id="match-editor-title">{record ? `${record.playedOn} 경기 기록` : '새 경기 기록'}</h3></div>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => dirty ? setConfirmClose(true) : onClose()}>{closeLabel}</button></div>
    <div className="match-category-context" data-category={competitionCategory(draft).key}><MatchCategoryBadge match={draft} /><span>{internal ? '우리끼리 나누는 A·B팀 경기' : draft.tournamentId != null ? <>{selectedTournament?.name ?? draft.tournamentName ?? '연결된 대회'}{draft.tournamentStage && ` · ${tournamentStageLabels[draft.tournamentStage]}`}</> : '매주 함께하는 정기 경기'}</span></div>
    {record && <div className="recording-checkpoint"><RecordingStatus stage={record.recordingStage} /><small>마지막 저장 상태</small></div>}
    {confirmClose && <div className="match-recovery-notice"><h4>목록으로 돌아갈까요?</h4><p>{storageWarning ? '초안을 보관하지 못했어요. 나가면 현재 입력을 잃을 수 있어요.' : '초안은 이 탭에 최대 24시간 보관돼요.'}</p><div className="registration-actions"><button type="button" className="secondary-button" onClick={onClose}>{storageWarning ? '저장 없이 나가기' : '보관하고 나가기'}</button>{(!pending || blocked) && <button type="button" className="danger-button" onClick={discardRecovery}>초안 버리고 나가기</button>}<button type="button" className="secondary-button" onClick={() => setConfirmClose(false)}>계속 작성</button></div></div>}
    {isAdmin && dirty && !pending && !blocked && !storageWarning && <div className="match-recovery-hint"><p role="status"><strong>초안 보관 중</strong><span>저장 버튼을 눌러 경기 기록에 반영하세요.</span></p><DraftRetentionHelp /></div>}
    {storageWarning && <p className="import-warning" role="alert">{storageWarning}</p>}
    {pending && !blocked && <div className="match-recovery-notice" role="status"><h4>{busy ? '저장 결과 확인 중…' : '저장 여부를 확인해 주세요'}</h4>{errorNotice}<p>입력한 내용은 보관 중이에요. 확인이 끝나면 다시 수정할 수 있어요.</p><button type="button" className="primary-button" disabled={busy || !isAdmin} onClick={() => void retryPending()}>{busy ? '확인 중…' : '저장 결과 확인'}</button></div>}
    {pending && legacyDraftEntries(draft).length > 0 && <details className="match-recovery-notice" open><summary>이전 포메이션으로 보관된 배치</summary><p>이전 저장 요청은 그대로 보관하고 있어요. 저장 결과를 확인한 뒤 새 포메이션 자리로 이어서 표시해요.</p><ul>{legacyDraftEntries(draft).map((entry, index) => <li key={index}>{entry.label} · {entry.quarterNumber}쿼터 {entry.team}팀 {entry.slot} → {currentDraftSlot(draft, entry.team, entry.slot)} · {draft.participants.find(p => p.playerId === entry.playerId)?.name ?? '선수 정보 없음'} · {entry.entryOrder === 0 ? '선발' : '교체'}{entry.stats && ` · ${entry.stats}`}</li>)}</ul></details>}
    {blocked && <div className="match-recovery-notice conflict"><h4>최신 기록을 확인해 주세요</h4>{errorNotice}<p>작성한 초안은 보관 중이에요. 최신 기록을 확인한 뒤 초안을 버리고 다시 작성해 주세요.</p><div className="registration-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => void viewLatest()}>최신 기록 보기</button><button type="button" className="danger-button" disabled={busy} onClick={() => setConfirmClose(true)}>초안 버리기</button></div>
      {serverMissing && <p role="status">경기 기록을 찾지 못했어요. 삭제되었거나 아직 저장되지 않았을 수 있어요.</p>}
      {latestServer && <details className="match-recovery-server" open><summary>최근 저장된 기록</summary><p>{latestServer.playedOn} · {matchTimeRange(latestServer.kickoff, latestServer.matchFormat)} · {latestServer.kind === 'INTERNAL' ? '자체전 A팀 vs B팀' : latestServer.opponent || '상대 팀 미입력'}</p><p>장소: {latestServer.venue || '장소 미입력'}</p><p>{recordingStageLabel(latestServer.recordingStage)} · 스코어 {latestServer.scoreFor === null ? '미입력' : `${latestServer.scoreFor} : ${latestServer.scoreAgainst}`} · 참석 {latestServer.participants.filter(canPlay).length}명</p><p>{latestServer.notes || '코멘트 없음'}</p><div className="match-table-scroll"><table className="match-table"><thead><tr><th>선수</th><th>출석</th><th>총 골 · 세부 득점</th><th>도움</th></tr></thead><tbody>{latestServer.participants.map(p => { const appearances = latestServer.quarters.flatMap(q => q.lineup).filter(a => a.playerId === p.playerId); return <tr key={p.playerId}><th scope="row">{playerLabel(p)}</th><td>{attendanceLabels[p.attendance]}</td><td>{appearances.reduce((sum, a) => sum + a.goals, 0)}<small>{goalBreakdownText(sumGoalBreakdown(appearances))}</small></td><td>{appearances.reduce((sum, a) => sum + a.assists, 0)}</td></tr> })}</tbody></table></div></details>}
    </div>}
    <details className="match-basics-disclosure" open={basicsOpen} onToggle={event => setBasicsOpen(event.currentTarget.open)} onInvalidCapture={() => setBasicsOpen(true)}>
      <summary className="match-basics-summary"><span><strong>경기 기본 정보</strong><span>{draft.playedOn || '날짜 미입력'} · {validKickoff(draft.kickoff) ? matchTimeRange(draft.kickoff, draft.matchFormat) : '시작 시간 미입력'}</span><span>{internal ? '자체전 · A팀 vs B팀' : draft.opponent || '상대 팀 미입력'} · {matchPeriodSummary(draft.matchFormat)}</span></span><span className="match-basics-toggle">{basicsOpen ? '접기 −' : '펼치기 +'}</span></summary>
    <div className="match-basics-content">
    <fieldset disabled={!editable} className="player-fields match-basics"><legend className="sr-only">경기 기본 정보</legend>
      <div className="match-kind-field"><label htmlFor="match-kind">경기 유형</label><select id="match-kind" value={draft.kind} disabled={kindLocked} onChange={e => { const next = { ...draft, kind: e.target.value as MatchKind, opponent: '', participants: draft.participants.map(p => ({ ...p, plannedTeam: null })), ...(e.target.value === 'INTERNAL' ? { tournamentId: null, tournamentName: null, tournamentStage: null, tournamentSelectionSpecified: true } : {}) }; change(e.target.value === 'INTERNAL' ? changeMatchFormat(next, 'FOUR_QUARTERS') : next); setTeam('A'); setQuarter(1) }}><option value="EXTERNAL">외부 경기 · 리그 / 대회</option><option value="INTERNAL">자체전 · A팀 vs B팀</option></select>
        <small className="match-time-help">{kindLocked ? '배치·스코어 입력 후 또는 저장 후에는 유형을 변경할 수 없습니다.' : '한 경기 전체에 적용됩니다.'}</small></div>
      <div><label htmlFor="match-date">경기 날짜 <span>필수</span></label><input id="match-date" type="date" required min="1000-01-01" max="9999-12-31" value={draft.playedOn} onChange={e => change({ ...draft, playedOn: e.target.value })} /></div>
      <div><label id="match-time-label" htmlFor="match-hour">시작 시간 <span>필수 · 30분 단위</span></label>
        <div className="match-time-selects" role="group" aria-labelledby="match-time-label">
          <select id="match-hour" aria-label="시작 시" aria-describedby="match-time-help" required value={kickoffHour} onChange={e => changeKickoff(e.target.value, kickoffMinute)}>
            <option value="">시 선택</option>{kickoffHours.map(hour => <option key={hour} value={hour}>{hour}시</option>)}
          </select><span aria-hidden="true">:</span>
          <select id="match-minute" aria-label="시작 분" aria-describedby="match-time-help" required value={kickoffMinute} onChange={e => changeKickoff(kickoffHour, e.target.value)}>
            <option value="">분 선택</option>{kickoffMinutes.map(minute => <option key={minute} value={minute}>{minute}분</option>)}
          </select>
        </div><small id="match-time-help" className="match-time-help">{validKickoff(draft.kickoff) ? `${matchTimeRange(draft.kickoff, draft.matchFormat)}${draft.matchFormat === 'TWO_HALVES_30' ? ' · 휴식 시간 제외' : ''}` : draft.kickoff ? `기존 ${draft.kickoff.slice(0, 5)} · 30분 단위로 다시 선택` : draft.matchFormat === 'TWO_HALVES_30' ? '시작 시간 + 1시간 · 휴식 시간 제외' : '시작 시간 + 2시간으로 표시'}</small></div>
      {!internal && <div><label htmlFor="match-opponent">상대 팀 <span>선택</span></label><input id="match-opponent" maxLength={100} value={draft.opponent} onChange={e => change({ ...draft, opponent: e.target.value })} placeholder="상대 팀 이름" /></div>}
      <div><label htmlFor="match-venue">장소 <span>선택</span></label><input id="match-venue" maxLength={100} value={draft.venue} onChange={e => change({ ...draft, venue: e.target.value })} placeholder="경기장 이름" /></div>
    </fieldset>
    {!internal && <div className="match-tournament-fields">
      {isAdmin && <TournamentPicker allowCreate label="리그 / 대회" value={draft.tournamentId ?? null} selectedLabel={selectedTournament?.name ?? draft.tournamentName ?? undefined} disabled={!editable} onSessionExpired={onSessionExpired}
        onChange={chooseTournament} />
        }
      {draft.tournamentId != null && <div><label htmlFor="match-tournament-stage">대회 단계 <span>선택</span></label>
        <select id="match-tournament-stage" disabled={!editable} value={draft.tournamentStage ?? ''} onChange={event => change({ ...draft, tournamentStage: (event.target.value || null) as TournamentStage | null, tournamentSelectionSpecified: true })}>
          <option value="">미정</option>{Object.entries(tournamentStageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></div>}
      {tournamentError && <div className="tournament-picker-error" role="status">{tournamentError}<button type="button" className="secondary-button" disabled={busy} onClick={() => setTournamentRevision(value => value + 1)}>대회 정보 다시 불러오기</button></div>}
      {outsideTournamentDates(draft.playedOn, selectedTournament) && <p className="import-warning" role="status">경기 날짜가 대회 기간({selectedTournament!.startDate} ~ {selectedTournament!.endDate}) 밖이에요. 일정을 확인해 주세요.{isAdmin && ' 이대로도 저장할 수 있어요.'}</p>}
    </div>}
    <section className="formation-settings" aria-labelledby="match-format-title">
      <h4 id="match-format-title">경기 형식</h4>
      <label htmlFor="match-format">기록할 구간</label><select id="match-format" value={normalizeMatchFormat(draft.matchFormat)} disabled={!editable || internal} onChange={event => changeFormat(event.target.value as MatchFormat)}>
        <option value="FOUR_QUARTERS">4쿼터</option><option value="TWO_HALVES_30" disabled={internal}>전·후반 각 30분 · 2쿼터</option>
      </select>
      <p className="field-help">{internal ? '자체전은 4쿼터로 기록해요.' : draft.matchFormat === 'TWO_HALVES_30' ? '전반은 1쿼터, 후반은 2쿼터예요. 선발은 1쿼터, 교체한 두 선수는 각각 0.5쿼터로 집계하며 시간으로 환산하지 않아요.' : draft.tournamentId != null ? '기존 4쿼터 기록은 유지돼요. 3·4쿼터에 계획·실제 기록이 없다면 전·후반 형식으로 바꿀 수 있어요.' : '리그는 4쿼터로 시작해요. 외부 경기는 대회 등록 전에도 전·후반 형식을 선택할 수 있어요. 대회 기록으로 집계하려면 대회를 연결해 주세요.'}</p>
    </section>
    <FormationSelector draft={{ ...planning, quarters: draft.quarters.map(q => ({ ...q, lineup: [] })) }} editable={editable} onChange={next => { change(applySquad({ ...draft, formationA: next.formationA, formationB: next.formationB }, next.plannedLineup)); setPlanRevision(value => value + 1) }} />
    </div>
    </details>
    {!pending && !blocked && errorNotice}
    {!!record?.plannedLineup.length && isAdmin && <p className="field-help">예전 경기의 계획·실제 입력을 하나로 보여줘요. 실제 출전 기록이 있으면 그 기록을 우선하고, 작성 중인 경기에서 실제 기록이 없으면 계획 배치를 가져와요. 변경은 저장할 때 반영돼요.</p>}
    <div className="match-step-tabs" id="match-step-tabs" role="tablist" aria-label="경기 기록 입력 단계">{visibleSteps.map((index, order) =>
      <button key={index} type="button" role="tab" id={`match-tab-${index}`} aria-selected={step === index} aria-controls={`match-panel-${index}`} disabled={busy}
        onClick={() => goToStep(stepHeadings[index])} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? visibleSteps[(order + 1) % 3] : event.key === 'ArrowLeft' ? visibleSteps[(order + 2) % 3] : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : null
          if (next !== null) { event.preventDefault(); setStep(next); document.getElementById(`match-tab-${next}`)?.focus() }
        }} tabIndex={step === index ? 0 : -1}><span>0{order + 1}</span>{editorSteps[index]}</button>)}
    </div>
    <div role="tabpanel" id="match-panel-0" aria-labelledby="match-tab-0" hidden={step !== 0}>
    <section className="match-block" aria-labelledby="attendance-title"><div className="match-block-title"><h4 id="attendance-title" tabIndex={-1}>01 · 참석 명단</h4><span>참석 {eligible.length}명</span></div>
      <p className="field-help">참석 투표한 선수를 선택해 주세요. 선택하면 바로 참석으로 기록돼요. 변경된 인원만 아래에서 수정하세요.</p>
      {!internal && <AttendeePicker players={players} participants={draft.participants} editable={editable} referenceYear={referenceYear} onSelect={selectAttendee} />}
      {internal && <>
        {isAdmin && <GuestPicker players={players} selectedIds={draft.participants.filter(p => p.vote === 'ATTENDING').map(p => p.playerId)} disabled={!editable || draft.participants.length >= 200} onBusy={setBusy} onAdd={addGuest} onSessionExpired={onSessionExpired} />}
        <InternalTeamAssignment draft={planning} players={players} editable={editable} onChange={next => { change(applySquadTeamSelection(draft, next)); setPlanRevision(value => value + 1) }} />
      </>}
      {players.filter(p => p.playerType !== 'GUEST').length > 200 && !record && <p className="import-warning">첫 200명을 명단에 넣었습니다. 한 경기 명단은 최대 200명입니다.</p>}
      {!draft.participants.length && <p className="save-notice">선수단에 선수를 등록한 뒤 이 경기를 다시 열면 명단에 추가할 수 있습니다. 경기 기본 정보만 먼저 저장해도 됩니다.</p>}
      {!!draft.participants.length && <details ref={attendanceDetails} className="attendance-details"><summary>불참·지각 등 예외 수정</summary><div className="match-table-scroll"><table className="match-table"><thead><tr><th scope="col">선수</th><th scope="col">참불 투표</th><th scope="col">실제 출석</th></tr></thead>
        <tbody>{draft.participants.map(p => <tr key={p.playerId}><th scope="row">{p.playerType === 'GUEST' && '용병 · '}{p.name}<small>{shirtLabel(p.shirtNumber)}</small><small>{ageDescription(p.birthYear, referenceYear)}</small></th>
          <td>{isAdmin ? <select disabled={!editable} aria-label={`${playerLabel(p)} 투표`} value={p.vote} onChange={e => participant(p.playerId, { vote: e.target.value as Vote })}>{Object.entries(voteLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select> : voteLabels[p.vote]}</td>
          <td>{isAdmin ? <select id={`attendance-${p.playerId}`} disabled={!editable} aria-label={`${playerLabel(p)} 출석`} value={p.attendance} onChange={e => participant(p.playerId, { attendance: e.target.value as Attendance })}>{Object.entries(attendanceLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select> : attendanceLabels[p.attendance]}</td>
        </tr>)}</tbody></table></div></details>}
      {isAdmin && missingPlayers.length > 0 && draft.participants.length < 200 && <div className="import-tools"><label className="upload-label">경기 명단에 선수 추가<select disabled={!editable} value={addedPlayer} onChange={e => setAddedPlayer(e.target.value)}><option value="">선수 선택</option>{missingPlayers.map(p => <option key={p.id} value={p.id}>{playerLabel(p)}</option>)}</select></label>
        <button type="button" disabled={!editable || !addedPlayer} className="secondary-button" onClick={() => {
          const p = players.find(p => p.id === Number(addedPlayer))!
          change({ ...draft, participants: [...draft.participants, { playerId: p.id, name: p.name, shirtNumber: p.shirtNumber, birthYear: p.birthYear, playerType: p.playerType, vote: 'UNANSWERED', attendance: 'UNCONFIRMED' }] }); setAddedPlayer('')
        }}>명단에 추가</button></div>}
    </section>
    {stepActions('plan')}
    </div>
    <div role="tabpanel" id="match-panel-1" aria-labelledby="match-tab-1" hidden={step !== 1}>
    {isAdmin && <AutomaticLineup draft={planning} players={players} matchId={record?.id ?? null} disabled={!editable} onBusy={setBusy} onSessionExpired={onSessionExpired}
      onApply={plannedLineup => { change(applySquad(draft, plannedLineup)); setPlanRevision(v => v + 1); setError('') }} />}
    <MatchPlanner key={`${draft.kind}-${draft.matchFormat}-${planRevision}`} matchFormat={draft.matchFormat} internal={internal} formationA={draft.formationA} formationB={draft.formationB} entries={planning.plannedLineup} participants={planning.participants} players={players} editable={editable} referenceYear={referenceYear}
      shareControl={isAdmin && teamName && <SquadImageShare teamName={teamName} playedOn={draft.playedOn} kickoff={draft.kickoff} opponent={draft.opponent} unsaved={dirty || !record} internal={internal} matchFormat={draft.matchFormat} formationA={draft.formationA} formationB={draft.formationB} quarter={quarter} team={team} entries={planning.plannedLineup} participants={planning.participants} />}
      onChange={plannedLineup => { change(applySquad(draft, plannedLineup)); setError('') }} footer={stepActions('totals')} quarter={quarter} team={team} setQuarter={setQuarter} setTeam={setTeam} quarters={draft.quarters} onRecordEdit={appearanceAt}
      tools={isAdmin && !internal && <GuestPicker players={players} selectedIds={draft.participants.filter(p => p.vote === 'ATTENDING').map(p => p.playerId)} disabled={!editable || draft.participants.length >= 200} onBusy={setBusy} onAdd={addGuest} onSessionExpired={onSessionExpired} />} />
    </div>
    <div role="tabpanel" id="match-panel-3" aria-labelledby="match-tab-3" hidden={step !== 3}>
    <section className="match-block" aria-labelledby="match-totals"><div className="match-block-title"><h4 id="match-totals" tabIndex={-1}>03 · 경기 결과와 코멘트</h4><span>{matchPeriodSummary(draft.matchFormat)} 합계</span></div>
      <MatchResultGoals draft={draft} quarter={quarter} team={team} editable={editable} isAdmin={isAdmin} setQuarter={setQuarter} setTeam={setTeam}
        onChange={change} onSave={() => void persist(draft, `quarter-${quarter}`)} />
      {isAdmin && <CompletionReview draft={draft} disabled={!editable} onNavigate={reviewNavigate} />}
      <fieldset className="match-score-fields" disabled={!editable}><legend>최종 스코어 <span>{matchPeriodSummary(draft.matchFormat)} 합계 · 득점자 미상·자책골은 직접 정정 가능</span></legend>
        <label>{internal ? 'A팀 득점' : '우리 팀 득점'}<input id="match-score-for" type="number" min={0} max={99} step={1} value={draft.scoreFor ?? ''} placeholder="미입력" onChange={e => change({ ...draft, scoreFor: e.target.value === '' ? null : Number(e.target.value) })} /></label><span aria-hidden="true">:</span>
        <label>{internal ? 'B팀 득점' : '상대 팀 득점'}<input type="number" min={0} max={99} step={1} value={draft.scoreAgainst ?? ''} placeholder="미입력" onChange={e => change({ ...draft, scoreAgainst: e.target.value === '' ? null : Number(e.target.value) })} /></label>
      </fieldset>
      {!isAdmin && (['A', ...(internal ? ['B'] : [])] as MatchTeam[]).map(value => {
        const score = value === 'A' ? draft.scoreFor : draft.scoreAgainst
        return score !== null && score !== enteredGoals(value) && <p key={value} className="import-warning" role="status">{internal ? `${value}팀` : '우리 팀'} 스코어 {score}골과 해당 팀 선수별 득점 합계 {enteredGoals(value)}골이 다릅니다. 득점자 미입력·자책골 등이 있는지 확인해 주세요.</p>
      })}
      <label className="match-notes" htmlFor="match-notes">경기 후 코멘트 <span>선택 · 최대 3,000자</span><textarea id="match-notes" rows={3} maxLength={3000} disabled={!editable} value={draft.notes} onChange={e => change({ ...draft, notes: e.target.value })} placeholder="경기 흐름, 기억할 장면, 다음 경기를 위한 메모를 남겨 주세요." /></label>
      <h5>선수별 실제 기록 집계 · {totals.length}명</h5>
      <p className="field-help">02단계에 배치한 선수만 표시해요. 교체 선수도 포함하며, 출석만 한 선수는 01단계에서 확인해 주세요.</p>
      <p className="field-help">총 골은 일반 골·직접 프리킥·경기 중 PK의 합계예요. 승부차기는 포함하지 않아요.</p>
      <div className="match-table-scroll"><table className="match-table"><thead><tr><th scope="col">선수</th><th scope="col">출석</th><th scope="col">출전 쿼터</th><th scope="col">총 골 · 세부 득점</th><th scope="col">도움</th></tr></thead><tbody>
        {totals.length === 0 && <tr><td colSpan={5}>아직 실제 출전 기록이 없어요. 02단계에서 출전 선수를 입력해 주세요.</td></tr>}
        {totals.map(p => <tr key={p.playerId}><th scope="row">{p.playerType === 'GUEST' && '용병 · '}{p.name}<small>{shirtLabel(p.shirtNumber)} · {ageBand(p.birthYear, referenceYear)}</small></th><td>{attendanceLabels[p.attendance]}</td><td>{p.appearances.length ? <>{p.appearances.map(a => `${a.quarter}Q${internal ? ` ${a.team}팀` : ''}(${a.share})`).join(' · ')}<small>합계 {p.credited}쿼터</small></> : '출전 기록 없음'}</td><td>{p.goals}<small>{goalBreakdownText(p)}</small></td><td>{p.assists}</td></tr>)}
      </tbody></table></div>
      {isAdmin && <div className="match-step-actions match-complete-action">
        <p className="field-help">기록을 확인했다면 완료로 표시해 주세요. 빈 항목이 있어도 완료할 수 있어요.</p>
        <p className="field-help">완료 후에도 수정할 수 있어요. 중간 저장하면 다시 작성 중으로 바뀌어요.</p>
      </div>}
    </section>
    </div>
    {isAdmin && <div className="match-save-bar match-save-dock" aria-label="경기 저장">
      <span>{pending ? '저장 여부를 먼저 확인해 주세요.' : blocked ? '최신 기록 확인이 필요해요.' : record?.recordingStage === 'COMPLETED' ? '중간 저장 시 작성 중으로 변경' : `${dirty ? '미저장 · ' : ''}0${visibleSteps.indexOf(step) + 1} ${editorSteps[step]}`}</span>
      <div className="match-save-dock-actions">
        <button type="submit" value="save" className="secondary-button" disabled={!editable} aria-label="중간 저장 후 경기 목록으로">{busy ? '처리 중…' : '목록'}</button>
        <button type="submit" value={step === 0 ? 'plan' : step === 1 ? 'totals' : 'complete'} className="primary-button" disabled={!editable}
          aria-label={step === 0 ? '참석 명단 저장 후 스쿼드로' : step === 1 ? '스쿼드·기록 저장 후 결과로' : '기록 완료 후 경기 목록으로'}>{busy ? '처리 중…' : step === 0 || step === 1 ? '다음' : '완료'}</button>
      </div>
    </div>}
  </form>
}
