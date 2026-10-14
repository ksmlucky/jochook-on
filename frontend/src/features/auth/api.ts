export interface CurrentUser {
  username: string
  role: 'ADMIN' | 'MEMBER'
}

export class SessionExpiredError extends Error { }

export async function getCurrentUser(signal?: AbortSignal): Promise<CurrentUser | null> {
  const response = await fetch('/api/v1/auth/me', { signal, cache: 'no-store' })
  if (response.status === 401) return null
  if (!response.ok) throw new Error('로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요.')
  const data: unknown = await response.json()
  if (typeof data !== 'object' || data === null || !('username' in data) || !('role' in data)
    || typeof data.username !== 'string' || !['ADMIN', 'MEMBER'].includes(String(data.role))) {
    throw new Error('로그인 정보 형식을 확인할 수 없습니다.')
  }
  return data as CurrentUser
}

export async function fetchWithCsrf(path: string, options: RequestInit): Promise<Response> {
  // 로그인·로그아웃 후 토큰이 바뀌므로 변경 요청마다 현재 세션의 토큰을 얻는다.
  const csrfResponse = await fetch('/api/v1/auth/csrf', { cache: 'no-store' })
  if (!csrfResponse.ok) throw new Error('서버에 연결하지 못했습니다. 다시 시도해 주세요.')
  const csrf: { headerName: string; token: string } = await csrfResponse.json()
  const headers = new Headers(options.headers)
  headers.set(csrf.headerName, csrf.token)
  return fetch(path, { ...options, headers })
}

export async function login(username: string, password: string): Promise<CurrentUser> {
  const response = await fetchWithCsrf('/api/v1/auth/login', { method: 'POST', body: new URLSearchParams({ username, password }) })
  if (response.status === 401) throw new Error('아이디 또는 비밀번호를 확인해 주세요.')
  if (response.status === 403) throw new Error('로그인 요청이 만료되었습니다. 다시 시도해 주세요.')
  if (!response.ok) throw new Error('로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  const user = await getCurrentUser()
  if (!user) throw new Error('로그인 세션을 확인하지 못했습니다. 다시 시도해 주세요.')
  return user
}

export async function logout(): Promise<void> {
  const response = await fetchWithCsrf('/api/v1/auth/logout', { method: 'POST' })
  if (!response.ok) throw new Error('로그아웃하지 못했습니다. 다시 시도해 주세요.')
}
