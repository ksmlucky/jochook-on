import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { acceptInvitation, AccessRequestError, inspectInvitation } from './api'
import type { CurrentUser } from './api'
import type { TeamDisplay } from '../../app/team'
import { roleLabels } from './permissions'
import type { ManagerRole } from './permissions'
import { LoginForm } from './LoginForm'
import { useEditGuard, useLeaveGuard } from '../../app/LeaveGuard'
import { accessMessage, koreanTime, useRetryLimit } from '../teams/AccessUi'

export function InvitationPanel({ token, user, onLogin, onAccepted, onCancel, onSessionExpired }: {
  token: string; user: CurrentUser | null; onLogin: (user: CurrentUser) => void; onAccepted: (user: CurrentUser) => void; onCancel: () => void; onSessionExpired: () => void
}) {
  const [invitation, setInvitation] = useState<{ team: TeamDisplay; label: string; expiresAt: string; role: ManagerRole } | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loginMode, setLoginMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [unusable, setUnusable] = useState(false)
  const submitting = useRef(false)
  const limit = useRetryLimit()
  const guard = useLeaveGuard()
  useEditGuard(!!(username || password || confirmation), busy)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setInvitation(null)
    inspectInvitation(token, controller.signal).then(result => { if (!controller.signal.aborted) { setInvitation(result); setUnusable(false) } }).catch(cause => {
      if (!controller.signal.aborted) { limit.inspect(cause); setError(accessMessage(cause)); setUnusable(cause instanceof AccessRequestError && ([400, 404, 410].includes(cause.status) || cause.code === 'INVALID_INVITATION')) }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [token, attempt])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current || !invitation || limit.seconds) return
    const account = user?.authType === 'ACCOUNT'
    if (!account && (password !== confirmation || password.length < 12 || new TextEncoder().encode(password).length > 72)) {
      setError('비밀번호는 12자 이상, UTF-8 72바이트 이내로 입력하고 두 칸을 같게 입력해 주세요.'); return
    }
    submitting.current = true; setBusy(true); setError('')
    try { const result = await acceptInvitation(token, account ? undefined : { username: username.trim(), password }); setPassword(''); setConfirmation(''); setUsername(''); onAccepted(result) }
    catch (cause) {
      limit.inspect(cause); setError(accessMessage(cause))
      if (cause instanceof AccessRequestError && cause.code === 'ACCOUNT_EXISTS') { setPassword(''); setConfirmation(''); setUsername(''); setLoginMode(true) }
      if (cause instanceof AccessRequestError && ([404, 410].includes(cause.status) || cause.code === 'INVALID_INVITATION')) setUnusable(true)
      if (cause instanceof AccessRequestError && cause.code === 'SESSION_EXPIRED') onSessionExpired()
    } finally { submitting.current = false; setBusy(false) }
  }
  async function showLogin() {
    if (!await guard.confirmLeave()) return
    setUsername(''); setPassword(''); setConfirmation(''); setLoginMode(true)
  }
  async function showNewAccount() {
    if (await guard.confirmLeave()) setLoginMode(false)
  }
  return <section className="access-section" aria-labelledby="invitation-title">
    <div className="section-heading"><div><p className="eyebrow muted">TEAM INVITATION</p><h2 id="invitation-title">운영진 초대</h2></div><button className="secondary-button" onClick={onCancel} disabled={busy}>접속 홈으로</button></div>
    {loading && <p className="save-notice" role="status">초대 상태를 확인하고 있습니다.</p>}
    {error && <p className="form-error access-error" role="alert">{error}</p>}
    {limit.seconds > 0 && <p className="save-notice" role="status">{limit.seconds}초 후 다시 시도해 주세요.</p>}
    {!loading && !invitation && !unusable && <button className="secondary-button" onClick={() => setAttempt(value => value + 1)} disabled={limit.seconds > 0}>초대 다시 확인</button>}
    {unusable && <div className="empty-state"><h3>이 초대는 사용할 수 없습니다.</h3><p>초대를 발급한 감독 또는 서비스관리자에게 새 링크를 요청해 주세요.</p></div>}
    {invitation && !unusable && <>
      <div className="access-team-banner"><strong>{invitation.team.name}</strong><span>{roleLabels[invitation.role]}로 초대받았습니다.</span><small>수락 기한 · {koreanTime(invitation.expiresAt)}</small></div>
      {loginMode && user?.authType !== 'ACCOUNT' ? <><LoginForm onLogin={account => { setLoginMode(false); onLogin(account) }} /><button className="access-text-button" onClick={() => void showNewAccount()}>새 계정으로 참여하기</button></>
        : <form className="access-panel access-form" onSubmit={submit} aria-busy={busy}>
          <h3>{user?.authType === 'ACCOUNT' ? '현재 계정으로 참여할까요?' : '처음 사용할 계정을 설정해 주세요.'}</h3>
          {user?.authType === 'ACCOUNT' ? <p><strong>{user.username}</strong> 계정으로 <strong>{invitation.team.name}</strong>의 {roleLabels[invitation.role]} 초대를 수락합니다.</p>
            : <fieldset disabled={busy || limit.seconds > 0}><label>아이디 <span>필수</span><input required autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={40} value={username} onChange={event => setUsername(event.target.value)} /></label>
              <p className="field-help">영문 소문자로 시작하는 3~40자입니다. 이미 가진 아이디라면 기존 계정으로 로그인해 주세요.</p>
              <label>비밀번호 <span>필수</span><input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={event => setPassword(event.target.value)} /></label>
              <label>비밀번호 확인 <span>필수</span><input type="password" autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label><p className="field-help">12자 이상 · UTF-8 72바이트 이내</p></fieldset>}
          <button className="primary-button" disabled={busy || limit.seconds > 0}>{busy ? '참여 처리 중…' : user?.authType === 'ACCOUNT' ? '현재 계정으로 초대 수락' : '계정 설정 · 팀 참여'}</button>
          {user?.authType !== 'ACCOUNT' && <button className="secondary-button" type="button" onClick={() => void showLogin()} disabled={busy}>기존 계정으로 로그인하고 수락</button>}
          <p className="access-note">초대는 한 번만 사용할 수 있습니다. 계정과 초대 링크를 다른 사람에게 공유하지 마세요.</p>
        </form>}
    </>}
  </section>
}
