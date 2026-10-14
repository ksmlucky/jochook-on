import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentUser, identityOf, logout } from './api'
import type { CurrentUser } from './api'
import { ACCESS_CHANGED_EVENT, configureTeamAccess, lockTeamAccess } from './teamRequest'

type AuthState = { status: 'loading' } | { status: 'error' } | { status: 'anonymous' } | { status: 'authenticated'; user: CurrentUser }
export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [message, setMessage] = useState('')
  const [accessIssue, setAccessIssue] = useState('')
  const userRef = useRef<CurrentUser | null>(null)
  const generation = useRef(0)
  const refreshAbort = useRef<AbortController | null>(null)
  const signedIn = useCallback((user: CurrentUser | null) => {
    generation.current += 1
    refreshAbort.current?.abort()
    userRef.current = user
    configureTeamAccess(user)
    setMessage(''); setAccessIssue(''); setState(user ? { status: 'authenticated', user } : { status: 'anonymous' })
  }, [])
  const refresh = useCallback(async () => {
    refreshAbort.current?.abort()
    const controller = new AbortController(); refreshAbort.current = controller
    const version = ++generation.current
    try { const user = await getCurrentUser(controller.signal); if (version === generation.current && !controller.signal.aborted) signedIn(user) }
    catch (cause) { if (!controller.signal.aborted && version === generation.current) { setMessage(cause instanceof Error ? cause.message : '서버에 연결하지 못했습니다.'); setState({ status: 'error' }) } }
  }, [signedIn])
  useEffect(() => { void refresh(); return () => refreshAbort.current?.abort() }, [refresh])
  useEffect(() => {
    const changed = (event: Event) => setAccessIssue((event as CustomEvent<string>).detail || '접속 상태가 변경되었습니다. 다시 확인해 주세요.')
    window.addEventListener(ACCESS_CHANGED_EVENT, changed)
    return () => window.removeEventListener(ACCESS_CHANGED_EVENT, changed)
  }, [])
  useEffect(() => {
    let request: AbortController | null = null
    const check = async () => {
      if (document.visibilityState === 'hidden' || !userRef.current || accessIssue || request) return
      const before = identityOf(userRef.current), version = generation.current
      request = new AbortController()
      try {
        const fresh = await getCurrentUser(request.signal)
        if (version === generation.current && identityOf(fresh) !== before) lockTeamAccess('팀·계정 권한·접속 방식이 바뀌었거나 접속이 종료되었습니다. 현재 입력을 잘못 저장하지 않도록 접속 상태를 다시 확인해 주세요.')
      } catch { /* 통신 오류는 입력을 유지한다. 저장 요청은 서버에서 팀을 다시 확인한다. */ }
      finally { request = null }
    }
    const visible = () => { void check() }
    window.addEventListener('focus', visible); document.addEventListener('visibilitychange', visible)
    return () => { request?.abort(); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible) }
  }, [accessIssue])
  const expired = useCallback(() => lockTeamAccess('접속이 만료되었습니다. 현재 입력을 다른 팀에 저장하지 않도록 접속 상태를 다시 확인해 주세요.'), [])
  async function signOut(): Promise<boolean> {
    if (isLoggingOut) return false
    setIsLoggingOut(true); setMessage('')
    try { await logout(); signedIn(null); return true }
    catch (error) { setMessage(error instanceof Error ? error.message : '로그아웃에 실패했습니다.'); return false }
    finally { setIsLoggingOut(false) }
  }
  return { state, isLoggingOut, message, accessIssue, signOut, refresh, retry: refresh, signedIn, expired }
}
