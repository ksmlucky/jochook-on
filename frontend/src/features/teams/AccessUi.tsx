import { useEffect, useRef, useState } from 'react'
import { FadeToast } from '../../app/FadeToast'
import { AccessRequestError } from '../auth/api'
import './team-code-password.css'

export const accessMessage = (cause: unknown) => cause instanceof Error ? cause.message : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
export const isSessionFailure = (cause: unknown) => cause instanceof AccessRequestError && [401, 403].includes(cause.status)
export function koreanTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '확인 필요' : new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}
export function useRetryLimit() {
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(Date.now)
  useEffect(() => { if (until <= Date.now()) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [until])
  return { seconds: Math.max(0, Math.ceil((until - now) / 1000)), inspect: (cause: unknown) => {
    if (cause instanceof AccessRequestError && cause.status === 429) { setNow(Date.now()); setUntil(Date.now() + Math.max(1, cause.retryAfterSeconds || 600) * 1000) }
  } }
}
export function AccessToast({ message, clear }: { message: string; clear: () => void }) {
  const clearRef = useRef(clear)
  clearRef.current = clear
  useEffect(() => { if (!message) return; const timer = setTimeout(() => clearRef.current(), 4500); return () => clearTimeout(timer) }, [message])
  return <FadeToast message={message} />
}
export function ConfirmAction({ title, description, confirmLabel, onConfirm, onCancel, danger = false }: {
  title: string; description: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; danger?: boolean
}) {
  const previousFocus = useRef(document.activeElement as HTMLElement | null)
  useEffect(() => () => previousFocus.current?.focus(), [])
  // Keep confirmations inside the access boundary so hidden/inert also locks them.
  return <div className="dialog-backdrop"><div className="leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby="access-confirm-title" aria-describedby="access-confirm-description"
    onKeyDown={event => { if (event.key === 'Escape') onCancel(); if (event.key === 'Tab') { event.preventDefault(); const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button'); (document.activeElement === buttons[0] ? buttons[1] : buttons[0])?.focus() } }}>
    <h3 id="access-confirm-title">{title}</h3><p id="access-confirm-description">{description}</p><div className="registration-actions">
      <button className="secondary-button" autoFocus onClick={onCancel}>취소</button><button className={danger ? 'danger-button' : 'primary-button'} onClick={onConfirm}>{confirmLabel}</button>
    </div>
  </div></div>
}
type OneTimeSecretProps = { title: string; value: string; expiresAt: string; onClose: () => void }
  & ({ invite: true; password?: never } | { invite?: false; password: string })

export function OneTimeSecret({ title, value, expiresAt, invite, password, onClose }: OneTimeSecretProps) {
  const [copied, setCopied] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const passwordField = useRef<HTMLInputElement>(null)
  async function copy(kind: 'code' | 'password' | 'guide') {
    const text = kind === 'password' ? password! : kind === 'guide'
      ? `조축ON 팀 접속 안내\n팀 코드: ${value}\n팀 비밀번호: ${password}\n유효 기한: ${koreanTime(expiresAt)} (한국 시간)\n팀 코드와 비밀번호를 함께 입력해 주세요.` : value
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind === 'password' ? '팀 비밀번호를 복사했습니다.' : kind === 'guide' ? '팀 코드와 비밀번호 안내를 함께 복사했습니다.' : invite ? '초대 링크를 복사했습니다.' : '팀 코드를 복사했습니다.'); setError('')
    }
    catch {
      setCopied(''); setError('자동 복사를 사용할 수 없습니다. 아래 입력란의 내용을 선택해 직접 복사해 주세요.')
      if (kind === 'password') { setShowPassword(true); passwordField.current?.focus(); passwordField.current?.select() }
      else { field.current?.focus(); field.current?.select() }
    }
  }
  return <section className="access-panel secret-result" aria-labelledby="secret-title">
    <p className="eyebrow muted">{invite ? 'INVITATION READY' : 'TEAM ACCESS CODE'}</p><h3 id="secret-title">{title}</h3>
    <p>{invite ? '초대 링크는 지정한 운영진에게만 전달해 주세요. 링크를 가진 사람이 운영진으로 참여할 수 있어요.' : '팀 코드와 비밀번호를 팀원에게 함께 전달해 주세요. 가입 없이 선수단과 경기 기록을 볼 수 있어요.'}</p>
    <label className="secret-field">{invite ? '일회용 운영진 초대 링크' : '회원 조회 코드'}<input ref={field} readOnly value={value} autoComplete="off" spellCheck={false} onFocus={event => event.target.select()} /></label>
    {!invite && <div className="secret-field team-password-result">
      <label htmlFor="issued-team-password">팀 비밀번호 · 숫자 6자리</label>
      <div className="team-password-control"><input ref={passwordField} id="issued-team-password" type={showPassword ? 'text' : 'password'} readOnly value={password} autoComplete="off" spellCheck={false} onFocus={event => event.target.select()} />
        <button type="button" className="team-password-toggle" aria-label={showPassword ? '발급된 팀 비밀번호 숨기기' : '발급된 팀 비밀번호 보기'} aria-pressed={showPassword}
          aria-controls="issued-team-password" onClick={() => setShowPassword(value => !value)}>{showPassword ? '숨기기' : '보기'}</button></div>
      <p className="field-help">운영진의 개인 로그인 비밀번호와는 달라요.</p>
    </div>}
    <p className="access-note">유효 기한 · {koreanTime(expiresAt)} (한국 시간)</p>
    <p className="access-warning"><strong>이 화면에서만 확인할 수 있어요.</strong><br />닫기 전에 복사해 주세요. 잃어버리면 재발급해야 해요.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {copied && <p className="save-notice" role="status">{copied}</p>}
    <div className="access-actions"><button className="secondary-button" onClick={() => void copy('code')}>{invite ? '초대 링크 복사' : '코드 복사'}</button>
      {!invite && <><button className="secondary-button" onClick={() => void copy('password')}>비밀번호 복사</button><button className="secondary-button" onClick={() => void copy('guide')}>코드·비밀번호 안내 복사</button></>}
      <button className="primary-button" onClick={onClose}>확인했어요 · 닫기</button></div>
  </section>
}
