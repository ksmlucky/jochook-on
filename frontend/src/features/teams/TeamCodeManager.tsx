import { useEffect, useRef, useState } from 'react'
import type { TeamDisplay } from '../../app/team'
import { useEditGuard } from '../../app/LeaveGuard'
import { SessionExpiredError } from '../auth/api'
import { getTeamCode, getTeamCodeHistory, issueTeamCode, revokeTeamCode } from './api'
import type { CodeHistoryEntry, CodeIssued, CodeState } from './api'
import { AccessToast, accessMessage, ConfirmAction, koreanTime, OneTimeSecret } from './AccessUi'

const statusLabels: Record<CodeState['status'], string> = { NONE: '미발급', ACTIVE: '사용 중', REVOKED: '폐기됨', EXPIRED: '만료됨' }
const actionLabels: Record<CodeHistoryEntry['action'], string> = { ISSUED: '발급', ROTATED: '재발급', REVOKED: '폐기' }
export function TeamCodeManager({ team, onSessionExpired }: { team: TeamDisplay; onSessionExpired: () => void }) {
  const [code, setCode] = useState<CodeState | null>(null)
  const [result, setResult] = useState<CodeIssued | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [historyRevision, setHistoryRevision] = useState(0)
  const [blocked, setBlocked] = useState(false)
  const [confirm, setConfirm] = useState<'issue' | 'revoke' | null>(null)
  const submitting = useRef(false)
  useEditGuard(!!result, busy)
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setBlocked(false)
    getTeamCode(controller.signal).then(data => { if (!controller.signal.aborted) setCode(data) }).catch(cause => {
      if (controller.signal.aborted) return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError(accessMessage(cause))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [attempt, onSessionExpired])
  async function change(action: 'issue' | 'revoke') {
    if (!code || submitting.current) return
    submitting.current = true; setBusy(true); setError(''); setConfirm(null)
    try {
      if (action === 'issue') { const issued = await issueTeamCode(code.version); setCode({ status: issued.status, version: issued.version, issuedAt: issued.issuedAt, expiresAt: issued.expiresAt }); setResult(issued); setNotice('팀 코드와 비밀번호를 발급했습니다.') }
      else { setCode(await revokeTeamCode(code.version)); setNotice('팀 코드와 비밀번호를 폐기했습니다. 기존 회원 접속도 종료됩니다.') }
      setHistoryRevision(value => value + 1)
    } catch (cause) {
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else { setError(`${accessMessage(cause)} 최신 코드 상태를 확인한 뒤 다시 진행해 주세요.`); setBlocked(true) }
    } finally { submitting.current = false; setBusy(false) }
  }
  return <section className="access-section" aria-labelledby="team-code-title">
    <div className="section-heading"><div><p className="eyebrow muted">{team.name} · TEAM ACCESS</p><h2 id="team-code-title">팀 코드와 비밀번호</h2></div></div>
    <p className="section-description">팀원에게 공유할 조회용 코드와 비밀번호를 관리해요.</p>
    <AccessToast message={notice} clear={() => setNotice('')} />
    {loading && <p className="save-notice" role="status">코드 상태 확인 중…</p>}
    {error && <div className="access-error" role="alert"><p>{error}</p><button className="secondary-button" disabled={busy} onClick={() => setAttempt(value => value + 1)}>최신 코드 상태 확인</button></div>}
    {result ? <OneTimeSecret title="팀 코드와 비밀번호가 준비됐어요." value={result.code.replace(/[\s-]/g, '').match(/.{1,4}/g)?.join('-') || result.code} password={result.password} expiresAt={result.expiresAt!} onClose={() => setResult(null)} />
      : code && !loading && <div className="access-panel code-management"><div className="access-panel-heading"><h3>회원 조회 코드</h3><span className={`access-status ${code.status === 'ACTIVE' ? 'active' : ''}`}>{statusLabels[code.status]}</span></div>
        <div className="masked-code" aria-label="팀 코드와 비밀번호 원문은 다시 표시하지 않습니다.">•••• — •••• — ••••</div>
        <dl className="access-details"><div><dt>접속 권한</dt><dd>현재 팀 조회만</dd></div><div><dt>발급일</dt><dd>{koreanTime(code.issuedAt)}</dd></div><div><dt>유효 기한</dt><dd>{koreanTime(code.expiresAt)}</dd></div></dl>
        <p className="access-note">코드와 6자리 비밀번호는 90일 동안 유효해요. 발급 직후 한 번만 볼 수 있으니 함께 보관해 주세요.</p>
        <p className="access-note">비밀번호가 없는 예전 코드는 재발급해 주세요.</p>
        <div className="access-actions"><button className="primary-button" disabled={busy || blocked} onClick={() => setConfirm('issue')}>{busy ? '처리 중…' : code.status === 'ACTIVE' ? '코드·비밀번호 재발급' : '코드·비밀번호 발급'}</button>
          {code.status === 'ACTIVE' && <button className="danger-button" disabled={busy || blocked} onClick={() => setConfirm('revoke')}>현재 코드·비밀번호 폐기</button>}</div>
        <p className="access-warning"><strong>재발급·폐기하면 회원 접속이 종료돼요.</strong><br />재발급 시 코드와 비밀번호가 모두 바뀌어요. 운영진의 개인 로그인은 유지돼요.</p>
      </div>}
    <TeamCodeHistory revision={historyRevision} onSessionExpired={onSessionExpired} />
    {confirm && <ConfirmAction title={confirm === 'revoke' ? '코드와 비밀번호를 폐기할까요?' : code?.status === 'ACTIVE' ? '코드와 비밀번호를 재발급할까요?' : '코드와 비밀번호를 발급할까요?'}
      description={confirm === 'revoke' ? '기존 팀 코드와 비밀번호를 사용할 수 없게 되고 기존 회원 접속도 종료됩니다. 다시 공유하려면 코드와 비밀번호를 새로 발급해야 합니다.' : code?.status === 'ACTIVE' ? '팀 코드와 비밀번호가 모두 바뀌고 기존 회원 접속도 종료됩니다. 새 코드와 비밀번호를 팀원들에게 함께 안내해 주세요.' : '팀 코드와 숫자 6자리 비밀번호를 함께 자동 생성합니다. 둘 다 받은 팀원은 가입 없이 현재 팀의 기록을 조회할 수 있습니다. 수정 권한은 포함되지 않습니다.'}
      confirmLabel={confirm === 'revoke' ? '코드·비밀번호 폐기' : '코드·비밀번호 발급'} danger={confirm === 'revoke'} onCancel={() => setConfirm(null)} onConfirm={() => void change(confirm)} />}
  </section>
}

function TeamCodeHistory({ revision, onSessionExpired }: { revision: number; onSessionExpired: () => void }) {
  const [entries, setEntries] = useState<CodeHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    getTeamCodeHistory(controller.signal).then(data => {
      if (!controller.signal.aborted) setEntries(data)
    }).catch(cause => {
      if (controller.signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError(accessMessage(cause))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [revision, attempt, onSessionExpired])
  return <section className="access-panel" aria-labelledby="code-history-title">
    <div className="access-panel-heading"><h3 id="code-history-title">코드 발급 이력</h3><button className="secondary-button" disabled={loading} onClick={() => setAttempt(value => value + 1)}>이력 새로고침</button></div>
    <p className="access-note">최근 20건 · 코드와 비밀번호 원문은 남기지 않아요.</p>
    {loading ? <p className="save-notice" role="status">코드 이력 불러오는 중…</p>
      : error ? <p className="form-error access-error" role="alert">{error} 이력 새로고침으로 다시 확인해 주세요.</p>
        : !entries.length ? <p className="access-empty">아직 코드 발급 이력이 없습니다.</p>
          : <div className="code-history-scroll" tabIndex={0} role="region" aria-label="최근 코드 발급 이력 표"><table className="code-history-table">
            <thead><tr><th scope="col">작업</th><th scope="col">처리한 운영진</th><th scope="col">처리 시각</th><th scope="col">코드 만료일</th></tr></thead>
            <tbody>{entries.map(entry => <tr key={entry.id}><td><strong>{actionLabels[entry.action]}</strong><small>버전 {entry.version}</small></td><td>{entry.actorUsername}</td><td><time dateTime={entry.occurredAt}>{koreanTime(entry.occurredAt)}</time></td><td>{entry.expiresAt ? <time dateTime={entry.expiresAt}>{koreanTime(entry.expiresAt)}</time> : '—'}</td></tr>)}</tbody>
          </table></div>}
  </section>
}
