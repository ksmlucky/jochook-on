import { useEffect, useRef, useState } from 'react'
import { FadeToast } from '../../app/FadeToast'
import { SessionExpiredError } from '../auth/api'
import type { Player } from '../players/api'
import { deleteMatch, fetchMatch, fetchMatches, fetchMatchPlayers, fetchMatchYears, MatchRequestError, playerLabel } from './api'
import { matchTimeRange } from './time'
import { matchFormatLabel, matchPeriodSummary } from './matchFormat'
import type { MatchPage, MatchRecord, MatchSummary } from './api'
import { MatchEditor } from './MatchEditor'
import { MatchHistory } from './MatchHistory'
import { RecordingStatus } from './RecordingStatus'
import { recordingStageLabel } from './recordingProgress'
import { ConfirmAction } from '../teams/AccessUi'
import { useEditGuard } from '../../app/LeaveGuard'
import type { TeamDisplay } from '../../app/team'
import { formationLabel } from './formations'
import { clearMatchRecovery, loadMatchRecovery } from './draftRecovery'
import type { DraftOwner, RecoverySnapshot } from './draftRecovery'
import { DraftRetentionHelp } from './DraftRetentionHelp'
import './match-recovery.css'
import { CompetitionFilter } from '../tournaments/CompetitionFilter'
import type { CompetitionSelection } from '../tournaments/competitionScope'
import { tournamentStageLabels } from './tournamentFields'
import { MatchCategoryBadge } from './MatchCategoryBadge'
import { competitionCategory } from './competitionCategory'
import { MonthRangeFilter } from '../../app/MonthRangeFilter'
import { YearOptionsStatus } from '../../app/YearOptionsStatus'
import { useAvailableYears } from '../../app/useAvailableYears'
import type { MonthRangeSelection } from '../../app/yearMonth'

export function MatchSection({ team, isAdmin, recoveryOwner, onSessionExpired, initialTournamentId = null, initialOpen }: { team: TeamDisplay; isAdmin: boolean; recoveryOwner: DraftOwner | null; onSessionExpired: () => void; initialTournamentId?: number | null; initialOpen?: number | 'new' }) {
  const [competition, setCompetition] = useState<CompetitionSelection>(() => ({ competitionScope: initialTournamentId == null ? 'ALL' : 'TOURNAMENT', tournamentId: initialTournamentId }))
  const { tournamentId, competitionScope } = competition
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [period, setPeriod] = useState<MonthRangeSelection>({ startMonth: null, endMonth: null })
  const availableYears = useAvailableYears(fetchMatchYears, onSessionExpired, revision)
  const [data, setData] = useState<MatchPage | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MatchSummary | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [history, setHistory] = useState(false)
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)
  const noticeId = useRef(0)
  const [editor, setEditor] = useState<{ record: MatchRecord | null; players: Player[]; recovered?: RecoverySnapshot; recoveryConflict?: string } | null>(null)
  const [recovery, setRecovery] = useState<RecoverySnapshot | null>(() => isAdmin && recoveryOwner ? loadMatchRecovery(recoveryOwner) : null)
  const [discardingRecovery, setDiscardingRecovery] = useState(false)
  const opening = useRef(false)
  const removing = useRef(false)
  const lifetime = useRef<AbortController | null>(null)
  useEditGuard(false, deleting)
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller
    return () => controller.abort()
  }, [])
  useEffect(() => {
    if (initialOpen === undefined || (initialOpen === 'new' && !isAdmin)) return
    // Deferred to the committed mount, so StrictMode's cancelled mount cannot open twice.
    const timer = window.setTimeout(() => {
      if (recovery) setError('보관 중인 초안이 있어요. 먼저 아래에서 이어서 작성하거나 초안을 버린 뒤 경기를 열어 주세요.')
      else void open(initialOpen === 'new' ? undefined : initialOpen)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [initialOpen])
  useEffect(() => { if (!isAdmin) { setDeleteTarget(null); setHistory(false) } }, [isAdmin])
  useEffect(() => {
    setRecovery(isAdmin && recoveryOwner ? loadMatchRecovery(recoveryOwner) : null)
  }, [isAdmin, recoveryOwner?.username, recoveryOwner?.teamId, revision])
  function closeEditor() {
    setEditor(null); setRecovery(recoveryOwner ? loadMatchRecovery(recoveryOwner) : null); setRevision(r => r + 1)
  }
  function notifySaved(message: string) { setNotice({ id: ++noticeId.current, message }) }
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError('')
    fetchMatches(page, controller.signal, tournamentId, competitionScope, period).then(result => {
      if (controller.signal.aborted) return
      // 삭제로 마지막 페이지가 비어도 존재하는 마지막 페이지로 돌아간다.
      if (page > 0 && page >= result.totalPages) setPage(Math.max(0, result.totalPages - 1))
      else setData(result)
    }).catch(cause => {
      if (controller.signal.aborted) return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError('경기 목록을 불러오지 못했습니다. 다시 시도해 주세요.')
    })
    return () => controller.abort()
  }, [page, revision, onSessionExpired, tournamentId, competitionScope, period])
  async function open(id?: number) {
    const signal = lifetime.current?.signal
    if (opening.current || removing.current || deleteTarget || recovery || !signal || signal.aborted) return
    opening.current = true; setBusy(true); setError(''); setDeleteError(''); setNotice(null)
    try {
      const [record, players] = await Promise.all([id ? fetchMatch(id, signal) : Promise.resolve(null), isAdmin ? fetchMatchPlayers(signal) : Promise.resolve([])])
      if (signal.aborted) return
      setEditor({ record, players })
    } catch (cause) {
      if (signal.aborted) return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError('경기 또는 선수 정보를 불러오지 못했습니다. 다시 시도해 주세요.')
    } finally { opening.current = false; if (!signal.aborted) setBusy(false) }
  }
  async function restore() {
    const signal = lifetime.current?.signal
    if (!recovery || !isAdmin || opening.current || removing.current || !signal || signal.aborted) return
    const available = recoveryOwner ? loadMatchRecovery(recoveryOwner) : null
    if (!available) { setRecovery(null); setError('보관 기간이 지났거나 초안이 삭제됐어요. 새 기록을 작성해 주세요.'); return }
    opening.current = true; setBusy(true); setError(''); setNotice(null)
    try {
      // A pending save may itself have advanced the version. Its receipt is checked in the editor.
      let conflict = ''
      if (available.record && !available.pending) {
        try {
          const latest = await fetchMatch(available.record.id)
          if (latest.version !== available.record.version) conflict = '초안을 작성한 뒤 경기 기록이 수정됐어요.'
        } catch (cause) {
          if (cause instanceof MatchRequestError && cause.status === 404) conflict = '원래 경기 기록이 삭제되었거나 조회할 수 없어요.'
          else throw cause
        }
      }
      const players = await fetchMatchPlayers(signal)
      if (signal.aborted) return
      setEditor({ record: available.record, players, recovered: available, recoveryConflict: conflict })
    } catch (cause) {
      if (signal.aborted) return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError('초안을 열지 못했어요. 입력한 내용은 보관 중이니 다시 시도해 주세요.')
    } finally { opening.current = false; if (!signal.aborted) setBusy(false) }
  }
  async function remove() {
    const signal = lifetime.current?.signal
    if (!deleteTarget || !isAdmin || removing.current || !signal || signal.aborted) return
    const target = deleteTarget
    removing.current = true; setDeleting(true); setDeleteTarget(null); setDeleteError(''); setNotice(null)
    try {
      await deleteMatch(target, signal)
      if (signal.aborted) return
      notifySaved(`${target.playedOn} 경기 기록을 삭제했습니다.`)
      setData(null); setRevision(value => value + 1)
    } catch (cause) {
      if (signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else {
        const message = cause instanceof MatchRequestError && cause.status === 409
          ? '다른 운영진이 경기 기록을 수정했습니다. 삭제하지 않았으니 최신 기록을 확인한 뒤 다시 시도해 주세요.'
          : cause instanceof MatchRequestError && cause.status === 404
            ? '이미 삭제되었거나 찾을 수 없는 경기입니다. 최신 목록을 확인해 주세요.'
            : '삭제 결과를 확인하지 못했습니다. 자동으로 재시도하지 않으니 최신 목록을 확인해 주세요.'
        setDeleteError(message); setData(null); setRevision(value => value + 1)
      }
    } finally { removing.current = false; if (!signal.aborted) setDeleting(false) }
  }
  const locked = busy || deleting || !!deleteTarget || !!recovery && !editor
  return <section className="directory-section" id="matches" aria-labelledby="matches-title">
    <div className="section-heading"><div><p className="eyebrow muted">MATCH DAY</p><h2 id="matches-title">경기 기록</h2></div>
      {!editor && !history && isAdmin && <div className="registration-actions"><button className="secondary-button" disabled={locked} onClick={() => setHistory(true)}>변경 이력</button><button className="primary-button" disabled={locked} onClick={() => void open()}>경기 기록 등록</button></div>}
    </div>
    <p className="section-description">참석 명단부터 스쿼드, 스코어까지. 한 경기씩 쌓아가요.</p>
    {!editor && !history && <div className="list-period-filter">
      <MonthRangeFilter value={period} years={availableYears.years} disabled={busy || deleting}
        onChange={value => { setPeriod(value); setPage(0) }} />
      <YearOptionsStatus loading={availableYears.loading} error={availableYears.error} onRetry={availableYears.retry} />
    </div>}
    {!editor && !history && <div className="match-competition-filter"><CompetitionFilter scope={competitionScope} tournamentId={tournamentId} tournamentName={competition.tournamentName}
      onChange={value => { setCompetition(value); setPage(0) }} disabled={busy || deleting} onSessionExpired={onSessionExpired} />
      {isAdmin && <a className="secondary-button competition-manage-link" href="#tournaments">대회 등록·관리</a>}</div>}
    {!editor && !history && isAdmin && recovery && <div className="match-recovery-notice" role="region" aria-labelledby="match-recovery-title">
      <div className="match-recovery-heading"><h3 id="match-recovery-title">작성 중인 경기</h3><span className="match-recovery-badge">{recovery.pending ? '저장 확인 필요' : '미저장 초안'}</span></div>
      <p className="match-recovery-match">{recovery.draft.kind === 'INTERNAL' ? '자체전 · A팀 vs B팀' : recovery.draft.opponent || '상대 팀 미입력'}</p>
      <p className="match-recovery-meta"><span>{recovery.draft.playedOn || '날짜 미입력'}</span><span>{['01 참석 명단', '02 스쿼드·기록', '02 스쿼드·기록', '03 결과·코멘트'][recovery.step]}</span></p>
      <p className="match-recovery-updated">최근 작성 <time dateTime={new Date(recovery.savedAt).toISOString()}>{new Date(recovery.savedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</time></p>
      {recovery.pending && <p>초안을 열어 저장 여부를 먼저 확인해 주세요.</p>}
      <div className="registration-actions"><button type="button" className="primary-button" disabled={busy || deleting} onClick={() => void restore()}>{recovery.pending ? '초안 열기' : '이어서 작성'}</button>{!recovery.pending && <button type="button" className="secondary-button" disabled={busy || deleting} onClick={() => setDiscardingRecovery(true)}>초안 버리기</button>}</div>
      <DraftRetentionHelp inList />
    </div>}
    <FadeToast message={notice?.message ?? ''} identity={notice?.id} />
    {error && <div className="save-notice" role="alert"><p>{error}</p><button className="secondary-button" onClick={() => setRevision(r => r + 1)}>목록 다시 불러오기</button></div>}
    {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
    {deleting && <p className="save-notice" role="status">경기 기록을 삭제하고 있습니다.</p>}
    {busy && <p className="save-notice" role="status">경기 입력 화면을 준비하고 있습니다.</p>}
    {history && isAdmin ? <MatchHistory onClose={() => { setHistory(false); setRevision(value => value + 1) }} onSessionExpired={onSessionExpired} /> : editor ? <MatchEditor key={editor.record?.id ?? 'new'} record={editor.record} players={editor.players} isAdmin={isAdmin} recoveryOwner={recoveryOwner} recovered={editor.recovered} recoveryConflict={editor.recoveryConflict}
      initialTournamentId={tournamentId} onSessionExpired={onSessionExpired} onClose={closeEditor} onStepSaved={notifySaved}
      onSaved={saved => { closeEditor(); setPage(0); notifySaved(`${saved.playedOn} · ${recordingStageLabel(saved.recordingStage)} 상태로 저장했습니다.`) }} /> : <>
      {!data && !error && <p className="save-notice" role="status">경기 목록을 불러오고 있습니다.</p>}
      {data?.items.length === 0 && <div className="empty-state"><span className="empty-number" aria-hidden="true">4Q</span><h3>{period.startMonth !== null ? '선택한 기간과 조건의 경기가 없어요' : tournamentId ? '이 대회에 연결된 경기가 없어요' : competitionScope === 'LEAGUE' ? '리그 경기 기록이 없어요' : competitionScope === 'TOURNAMENT' ? '대회에 연결된 경기 기록이 없어요' : '첫 경기의 기록을 남겨 보세요'}</h3><p>{period.startMonth !== null ? '기간 또는 경기 구분을 바꿔 다른 기록을 확인해 보세요.' : tournamentId || competitionScope === 'TOURNAMENT' ? '경기 기록에서 등록한 대회를 선택하면 이곳에 모여요.' : '투표 결과만 먼저 저장하고, 경기 후 출석과 기록을 이어서 입력할 수 있습니다.'}</p></div>}
      {!!data?.items.length && <ul className="match-list">{data.items.map(m => <li key={m.id} className={isAdmin ? 'match-list-item managed' : 'match-list-item'} data-category={competitionCategory(m).key}>
        <button className="match-card" disabled={locked} onClick={() => void open(m.id)}>
          <span className="match-date"><MatchCategoryBadge match={m} /><span>{m.playedOn}</span><small>{matchTimeRange(m.kickoff, m.matchFormat)}</small></span>
          <span className="match-card-details"><RecordingStatus stage={m.recordingStage} /><strong>{m.kind === 'INTERNAL' ? <>자체전 · A팀 <span className="muted-vs">vs</span> B팀</> : <>{team.name} <span className="muted-vs">vs</span> {m.opponent || '상대 팀 미입력'}</>}</strong><small>{m.venue || '장소 미입력'} · {m.kind === 'INTERNAL' ? `A ${formationLabel(m.formationA)} / B ${formationLabel(m.formationB)}` : formationLabel(m.formationA)} · {matchFormatLabel(m.matchFormat)}</small>
            {m.tournamentId != null && <span className="match-tournament-title">{m.tournamentName || '연결된 대회'}{m.tournamentStage && ` · ${tournamentStageLabels[m.tournamentStage]}`}</span>}
            <span className="match-scorers">{m.scorers.length ? <>득점 · {m.scorers.map(p => `${playerLabel(p)} ${m.kind === 'INTERNAL' ? [p.goalsA > 0 ? `A팀 ${p.goalsA}골` : '', p.goalsB > 0 ? `B팀 ${p.goalsB}골` : ''].filter(Boolean).join(' / ') : `${p.goals}골`}`).join(' · ')}{m.scorerCount > 3 && ` · 외 ${m.scorerCount - 3}명`}</> : '등록된 득점자 없음'}</span>
          </span>
          <span className={`match-score${m.scoreFor === null ? ' unrecorded' : ''}`} aria-label={m.scoreFor === null ? '스코어 미입력' : `${m.kind === 'INTERNAL' ? 'A팀' : '우리 팀'} ${m.scoreFor} 대 ${m.kind === 'INTERNAL' ? 'B팀' : '상대 팀'} ${m.scoreAgainst}`}>
            {m.scoreFor === null ? '스코어 미입력' : `${m.scoreFor} : ${m.scoreAgainst}`}<small>{m.kind === 'INTERNAL' ? 'A팀 : B팀' : '우리 팀 : 상대 팀'}</small>
          </span>
          <span className="match-open">{isAdmin && m.recordingStage && m.recordingStage !== 'COMPLETED' ? '이어서 작성 ↗' : '기록 보기 ↗'}</span>
        </button>
        {isAdmin && <div className="match-card-actions"><button type="button" className="danger-button" disabled={locked}
          aria-label={`${m.playedOn} ${m.kind === 'INTERNAL' ? '자체전' : m.opponent || '상대 팀 미입력'} 경기 기록 삭제`}
          onClick={() => { setDeleteError(''); setDeleteTarget(m) }}>삭제</button></div>}
      </li>)}</ul>}
      {data && data.totalPages > 1 && <div className="pagination"><button className="secondary-button" disabled={page === 0 || locked} onClick={() => setPage(p => p - 1)}>이전 경기 목록</button>
        <span>{page + 1} / {data.totalPages} · 총 {data.totalElements}경기 · 10개씩</span><button className="secondary-button" disabled={page + 1 >= data.totalPages || locked} onClick={() => setPage(p => p + 1)}>다음 경기 목록</button></div>}
    </>}
    {deleteTarget && isAdmin && <ConfirmAction title="이 경기 기록을 정말 삭제할까요?"
      description={`${deleteTarget.playedOn} ${matchTimeRange(deleteTarget.kickoff, deleteTarget.matchFormat)} · ${deleteTarget.kind === 'INTERNAL' ? '자체전 A팀 vs B팀' : `${team.name} vs ${deleteTarget.opponent || '상대 팀 미입력'}`}. 투표·출석 명단, ${matchPeriodSummary(deleteTarget.matchFormat)} 스쿼드 계획과 실제 출전·득점·도움 기록이 함께 삭제됩니다. 선수 명단과 변경 이력은 유지됩니다. 삭제한 경기를 복구하는 기능은 없습니다.`}
      confirmLabel="경기 기록 삭제" danger onCancel={() => setDeleteTarget(null)} onConfirm={() => void remove()} />}
    {discardingRecovery && recoveryOwner && <ConfirmAction title="초안을 버릴까요?" description="버린 초안은 복원할 수 없어요. 이미 저장한 경기 기록은 그대로 유지돼요." confirmLabel="초안 버리기" danger onCancel={() => setDiscardingRecovery(false)} onConfirm={() => { clearMatchRecovery(recoveryOwner); setRecovery(null); setDiscardingRecovery(false) }} />}
  </section>
}
