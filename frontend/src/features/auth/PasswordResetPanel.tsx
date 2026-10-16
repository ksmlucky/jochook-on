import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useEditGuard } from '../../app/LeaveGuard'
import { koreanTime, useRetryLimit } from '../teams/AccessUi'
import { AccessRequestError } from './api'
import { completePasswordReset, inspectResetLink, resetPasswordValidation, resetRequestMessage } from './passwordReset'
import type { ResetLinkInfo } from './passwordReset'
import './password-reset.css'

export function PasswordResetPanel({ token, onCompleted, onCancel }: { token: string; onCompleted: () => void; onCancel: () => void }) {
  const id = useId()
  const [info, setInfo] = useState<ResetLinkInfo | null>(null)
  const [checking, setChecking] = useState(true)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const mounted = useRef(true)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const retry = useRetryLimit()
  useEditGuard(false, busy)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { if (error) errorRef.current?.focus() }, [error])
  useEffect(() => {
    const controller = new AbortController()
    setInfo(null); setError(''); setInvalid(false); setChecking(true); setPassword(''); setConfirmation('')
    inspectResetLink(token, controller.signal).then(result => { if (!controller.signal.aborted) setInfo(result) }).catch(cause => {
      if (controller.signal.aborted) return
      retry.inspect(cause)
      setInvalid(cause instanceof AccessRequestError && cause.code === 'RESET_LINK_INVALID')
      setError(resetRequestMessage(cause, 'inspect'))
    }).finally(() => { if (!controller.signal.aborted) setChecking(false) })
    return () => controller.abort()
  }, [token, revision])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || !info || invalid || retry.seconds > 0) return
    const validation = resetPasswordValidation(password, confirmation)
    if (validation) { setError(validation); return }
    lock.current = true; setBusy(true); setError('')
    let completed = false
    try { await completePasswordReset(token, password); completed = true }
    catch (cause) {
      if (!mounted.current) return
      retry.inspect(cause)
      setInvalid(cause instanceof AccessRequestError && cause.code === 'RESET_LINK_INVALID')
      setError(resetRequestMessage(cause, 'complete'))
    } finally {
      lock.current = false
      if (mounted.current) { setBusy(false); setPassword(''); setConfirmation('') }
    }
    if (completed && mounted.current) onCompleted()
  }
  return <section className="password-reset-panel" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>비밀번호 다시 설정</h2>
    <p>서비스 관리자가 본인 확인 후 발급한 링크로 개인 계정의 비밀번호를 바꿔요.</p>
    {checking && <p role="status">복구 링크를 확인하고 있어요.</p>}
    {info && <div className="password-reset-info"><strong>계정 · {info.username}</strong><span>사용 기한 · {koreanTime(info.expiresAt)}</span><span>한 번만 사용할 수 있어요. 변경하면 대상 계정의 모든 로그인과 이 브라우저의 현재 로그인이 종료돼요. 새 비밀번호로 다시 로그인해 주세요.</span></div>}
    {info && <p className="password-reset-help">변경을 완료하면 현재 탭에 보관한 개인 계정의 미저장 초안도 지워져요. 저장된 경기 기록은 유지돼요.</p>}
    {error && <p className="form-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
    {retry.seconds > 0 && <p className="password-reset-help" role="status">{retry.seconds}초 뒤 다시 시도할 수 있어요.</p>}
    {info && !invalid && <form onSubmit={event => void submit(event)} noValidate aria-busy={busy}>
      <label htmlFor={`${id}-password`}>새 비밀번호</label>
      <input id={`${id}-password`} type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} required aria-describedby={`${id}-rules`} />
      <p className="password-reset-help" id={`${id}-rules`}>12자 이상 · UTF-8 기준 72바이트 이내 · 이전과 다른 비밀번호를 사용해 주세요. 한글은 보통 1자당 3바이트예요.</p>
      <label htmlFor={`${id}-confirmation`}>새 비밀번호 확인</label>
      <input id={`${id}-confirmation`} type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} required />
      <button className="primary-button" type="submit" disabled={busy || retry.seconds > 0}>{busy ? '변경 중…' : '새 비밀번호 저장'}</button>
    </form>}
    <div className="password-reset-actions">
      {!info && !checking && !invalid && <button type="button" className="secondary-button" disabled={retry.seconds > 0} onClick={() => setRevision(value => value + 1)}>링크 다시 확인</button>}
      <button type="button" className="secondary-button" disabled={busy} onClick={() => { if (lock.current) return; setPassword(''); setConfirmation(''); onCancel() }}>로그인 화면으로</button>
    </div>
  </section>
}
