import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useEditGuard } from '../../app/LeaveGuard'
import { useRetryLimit } from '../teams/AccessUi'
import { AccessRequestError } from './api'
import { changePassword, passwordChangeError, passwordChangeValidation } from './passwordChange'
import './password-change.css'

export function PasswordChangeForm({ onChanged, onSessionExpired, onCancel }: {
  onChanged: () => void
  onSessionExpired: () => void
  onCancel: () => void
}) {
  const id = useId()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const mounted = useRef(true)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const retry = useRetryLimit()
  useEditGuard(false, busy)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { if (error) errorRef.current?.focus() }, [error])

  function clearPasswords() { setCurrentPassword(''); setNewPassword(''); setConfirmation('') }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current || retry.seconds > 0) return
    const validation = passwordChangeValidation(currentPassword, newPassword, confirmation)
    if (validation) { setError(validation); return }
    submitting.current = true; setBusy(true); setError('')
    let changed = false
    let expired = false
    try {
      await changePassword(currentPassword, newPassword)
      changed = true
    } catch (cause) {
      if (!mounted.current) return
      retry.inspect(cause)
      expired = cause instanceof AccessRequestError && cause.status === 401
      setError(passwordChangeError(cause))
    } finally {
      submitting.current = false
      if (mounted.current) { clearPasswords(); setBusy(false) }
    }
    if (!mounted.current) return
    if (changed) onChanged()
    else if (expired) onSessionExpired()
  }

  return <section className="password-change-panel" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>내 비밀번호 변경</h2>
    <p>개인 로그인 계정의 비밀번호를 바꿔요. 팀 공유 비밀번호는 바뀌지 않아요.</p>
    <div className="password-change-notice" id={`${id}-notice`}>변경하면 모든 기기에서 다시 로그인해야 해요. 이 탭에 보관한 미저장 경기 초안도 삭제되니, 필요한 기록은 먼저 저장해 주세요.</div>
    <form onSubmit={event => void submit(event)} noValidate aria-describedby={`${id}-notice`} aria-busy={busy}>
      <label htmlFor={`${id}-current`}>현재 비밀번호</label>
      <input id={`${id}-current`} type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} disabled={busy} required />
      <label htmlFor={`${id}-new`}>새 비밀번호</label>
      <input id={`${id}-new`} type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} disabled={busy} required aria-describedby={`${id}-rules`} />
      <p className="password-change-help" id={`${id}-rules`}>12자 이상 · 현재와 다른 비밀번호<br />최대 72바이트예요. 영문·숫자는 1자당 1바이트, 한글은 보통 3바이트로 계산해요.</p>
      <label htmlFor={`${id}-confirm`}>새 비밀번호 확인</label>
      <input id={`${id}-confirm`} type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} required />
      {error && <p className="form-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
      {retry.seconds > 0 && <p className="password-change-help" role="status">{retry.seconds}초 뒤 다시 시도할 수 있어요.</p>}
      <div className="password-change-actions">
        <button type="button" className="secondary-button" disabled={busy} onClick={() => { if (submitting.current) return; clearPasswords(); onCancel() }}>취소</button>
        <button type="submit" className="primary-button" disabled={busy || retry.seconds > 0}>{busy ? '변경 중…' : '비밀번호 변경'}</button>
      </div>
    </form>
  </section>
}
