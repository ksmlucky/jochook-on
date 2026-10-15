import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { login } from './api'
import type { CurrentUser } from './api'
import { useEditGuard } from '../../app/LeaveGuard'

export function LoginForm({ onLogin }: { onLogin: (user: CurrentUser) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  useEditGuard(false, pending)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setPending(true)
    setError('')
    try { onLogin(await login(username, password)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '서버에 연결하지 못했습니다.') }
    finally { setPassword(''); setPending(false); submitting.current = false }
  }
  return <div className="login-panel">
    <div className="login-intro">
      <p className="eyebrow muted"><span className="intro-dot" />함께 만드는 팀의 기록</p>
      <h1>준비는 간편하게,<br /><span>축구는 즐겁게.</span></h1>
      <p>개인 계정으로 로그인하고<br />우리 팀의 기록을 관리해요.</p>
    </div>
    <form className="login-form" onSubmit={submit} aria-busy={pending}>
      <div className="access-form-title"><p className="form-kicker">MANAGER ACCESS</p><h2>운영진 로그인</h2><p>선수·경기 기록은 감독과 코치가 수정할 수 있어요.</p></div>
      <label htmlFor="username">아이디</label>
      <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false}
        maxLength={40} required value={username} onChange={event => setUsername(event.target.value)} disabled={pending} />
      <label htmlFor="password">비밀번호</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required
        value={password} onChange={event => setPassword(event.target.value)} disabled={pending} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? '로그인 중…' : '로그인'}</button>
      <p className="login-help">계정이 없거나 비밀번호를 잊었다면 초대해 준 관리자에게 문의해 주세요.</p>
    </form>
  </div>
}
