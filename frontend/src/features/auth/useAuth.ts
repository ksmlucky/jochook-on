import { useEffect, useState } from 'react'
import { getCurrentUser, logout } from './api'
import type { CurrentUser } from './api'

type AuthState = { status: 'loading' } | { status: 'error' } | { status: 'anonymous' }
  | { status: 'authenticated'; user: CurrentUser }

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    getCurrentUser(controller.signal)
      .then(user => { if (!controller.signal.aborted) setState(user ? { status: 'authenticated', user } : { status: 'anonymous' }) })
      .catch(() => { if (!controller.signal.aborted) setState({ status: 'error' }) })
    return () => controller.abort()
  }, [attempt])

  async function signOut() {
    setIsLoggingOut(true)
    setMessage('')
    try { await logout(); setState({ status: 'anonymous' }) }
    catch (error) { setMessage(error instanceof Error ? error.message : '로그아웃에 실패했습니다.') }
    finally { setIsLoggingOut(false) }
  }

  return {
    state, isLoggingOut, message, signOut,
    retry: () => setAttempt(value => value + 1),
    signedIn: (user: CurrentUser) => { setMessage(''); setState({ status: 'authenticated', user }) },
    expired: () => { setMessage('로그인이 만료되었습니다. 다시 로그인해 주세요.'); setState({ status: 'anonymous' }) },
  }
}
