import { useState } from 'react'
import type { FormEvent } from 'react'
import { login } from './api'
import type { CurrentUser } from './api'

export function LoginForm({ onLogin }: { onLogin: (user: CurrentUser) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    try { onLogin(await login(username, password)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '서버에 연결하지 못했습니다.') }
    finally { setPassword(''); setPending(false) }
  }
  return <div className="login-panel">
    <div className="login-intro">
      <p className="eyebrow muted">MEMBER ACCESS</p>
      <h3>우리 팀의 공간에<br />어서 오세요.</h3>
      <p>운영진이 안내한 계정으로 로그인하고<br />함께 뛰는 선수들을 만나보세요.</p>
    </div>
    <form className="login-form" onSubmit={submit} aria-busy={pending}>
      <label htmlFor="username">아이디</label>
      <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false}
        maxLength={40} required value={username} onChange={event => setUsername(event.target.value)} disabled={pending} />
      <label htmlFor="password">비밀번호</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required
        value={password} onChange={event => setPassword(event.target.value)} disabled={pending} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? '로그인 중…' : '로그인'}</button>
      <p className="login-help">계정이 없거나 비밀번호를 잊으셨다면 운영진에게 문의해 주세요.</p>
    </form>
  </div>
}
