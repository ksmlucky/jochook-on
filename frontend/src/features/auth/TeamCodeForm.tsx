import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { enterTeamCode } from './api'
import type { CurrentUser } from './api'
import { useEditGuard } from '../../app/LeaveGuard'
import { accessMessage, useRetryLimit } from '../teams/AccessUi'

export function TeamCodeForm({ onEntered, onLogin, onCancel, switching = false }: {
  onEntered: (user: CurrentUser) => void; onLogin: () => void; onCancel?: () => void; switching?: boolean
}) {
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const limit = useRetryLimit()
  useEditGuard(false, busy)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current || limit.seconds) return
    submitting.current = true; setBusy(true); setError('')
    try { const user = await enterTeamCode(code.trim(), password); setCode(''); setPassword(''); onEntered(user) }
    catch (cause) { limit.inspect(cause); setError(accessMessage(cause)) }
    finally { submitting.current = false; setBusy(false); setPassword(''); setShowPassword(false) }
  }
  return <div className="login-panel team-code-panel">
    <div className="login-intro"><p className="eyebrow muted"><span className="intro-dot" />함께 뛰는 조기축구</p><h1>{switching ? <>다른 팀의 기록도<br /><span>함께 만나보세요.</span></> : <>우리 팀의 축구를<br /><span>한곳에서.</span></>}</h1>
      <p>함께 뛰는 선수들, 이번 주 스쿼드, 지난 경기의 골.<br />우리 팀의 순간들을 차곡차곡 모아요.</p>
      <div className="access-feature-list"><span>선수단 관리</span><span>쿼터별 스쿼드</span><span>경기 기록</span></div>
      <svg className="welcome-pitch" viewBox="0 0 380 160" fill="none" aria-hidden="true"><rect x="2" y="2" width="376" height="156" rx="12" /><path d="M190 2v156M2 39h54v82H2M378 39h-54v82h54" /><circle cx="190" cy="80" r="32" /><circle cx="190" cy="80" r="3" className="pitch-marker" /><circle cx="104" cy="48" r="9" className="pitch-marker" /><circle cx="270" cy="108" r="9" className="pitch-marker" /><path d="m117 52 112 41m-11-16 11 16-19 4" strokeDasharray="5 6" /></svg>
    </div>
    <form className="login-form" name="team-member-access" autoComplete="off" onSubmit={submit} aria-busy={busy}>
      <div className="access-form-title"><p className="form-kicker">TEAM ACCESS</p><h2>우리 팀 들어가기</h2><p>운영진에게 받은 팀 코드와 비밀번호를 입력해 주세요.</p></div>
      <label htmlFor="team-access-code">팀 코드</label><input id="team-access-code" name="team-shared-code" value={code} onChange={event => setCode(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false}
        placeholder="운영진이 안내한 코드" maxLength={80} required disabled={busy || limit.seconds > 0} aria-describedby="code-input-help" />
      <p id="code-input-help" className="field-help">대소문자·공백·하이픈은 구분하지 않습니다.</p>
      <label htmlFor="team-access-password">팀 비밀번호</label>
      <div className="team-password-control">
        <input id="team-access-password" name="team-shared-pin" type={showPassword ? 'text' : 'password'} value={password}
          onChange={event => setPassword(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
          inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoComplete="section-team-access new-password" autoCapitalize="none" spellCheck={false}
          placeholder="숫자 6자리" disabled={busy || limit.seconds > 0} aria-describedby="team-password-help" />
        <button type="button" className="team-password-toggle" aria-label={showPassword ? '팀 비밀번호 숨기기' : '팀 비밀번호 보기'} aria-pressed={showPassword}
          aria-controls="team-access-password" disabled={busy || limit.seconds > 0} onClick={() => setShowPassword(value => !value)}>{showPassword ? '숨기기' : '보기'}</button>
      </div>
      <p id="team-password-help" className="field-help">팀 코드와 함께 안내받은 숫자 6자리예요.</p>
      {error && <p className="form-error" role="alert">{error}</p>}{limit.seconds > 0 && <p className="access-note" role="status">{limit.seconds}초 후 다시 시도해 주세요.</p>}
      <button className="primary-button" disabled={busy || limit.seconds > 0}>{busy ? '접속 확인 중…' : <>우리 팀 들어가기 <span aria-hidden="true">→</span></>}</button>
      <p className="code-privacy-note">회원 가입 없이 조회할 수 있어요.</p>
      {switching && <p className="access-note">새 팀 코드와 비밀번호가 확인되기 전에는 기존 팀의 조회 접속을 유지합니다.</p>}
      <div className="manager-entry"><span>팀의 기록을 관리하시나요?</span><button className="secondary-button" type="button" onClick={() => { setPassword(''); setShowPassword(false); onLogin() }} disabled={busy}>운영진 로그인</button></div>
      {onCancel && <button type="button" className="access-text-button" onClick={() => { setPassword(''); setShowPassword(false); onCancel() }} disabled={busy}>현재 팀으로 돌아가기</button>}
    </form>
  </div>
}
