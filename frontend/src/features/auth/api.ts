import type { MyTeam, TeamDisplay } from '../../app/team'
import type { ManagerRole, TeamRole } from './permissions'

export interface CurrentUser {
  username: string | null
  role: TeamRole
  authType: 'ACCOUNT' | 'TEAM_CODE'
  serviceAdmin: boolean
  team: TeamDisplay | null
  teams: MyTeam[]
}
export class SessionExpiredError extends Error {
  constructor(message = '접속이 만료되었거나 팀 접속 상태가 변경되었습니다. 다시 확인해 주세요.') { super(message) }
}
export class AccessRequestError extends Error {
  constructor(message: string, public status: number, public code: string, public retryAfterSeconds = 0) { super(message) }
}
export async function readAccess<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: string; code?: string; retryAfterSeconds?: number } | null
    throw new AccessRequestError(error?.message || (response.status === 401 ? '접속이 만료되었습니다. 다시 접속해 주세요.' : response.status === 403 ? '이 작업에 필요한 권한이 없습니다.' : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'), response.status, error?.code || 'REQUEST_FAILED', error?.retryAfterSeconds || Number(response.headers.get('Retry-After')) || 0)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
function validateUser(data: unknown): CurrentUser {
  if (typeof data !== 'object' || data === null || !('authType' in data) || !('role' in data)
    || !['ACCOUNT', 'TEAM_CODE'].includes(String(data.authType)) || !['DIRECTOR', 'COACH', 'MEMBER'].includes(String(data.role))
    || !('serviceAdmin' in data) || typeof data.serviceAdmin !== 'boolean' || !('teams' in data) || !Array.isArray(data.teams)
    || !('team' in data) || (data.team !== null && (typeof data.team !== 'object' || !('id' in data.team) || !Number.isSafeInteger(data.team.id)))) {
    throw new Error('접속 정보 형식을 확인할 수 없습니다. 다시 접속해 주세요.')
  }
  return data as CurrentUser
}
export async function getCurrentUser(signal?: AbortSignal): Promise<CurrentUser | null> {
  const response = await fetch('/api/v1/auth/me', { signal, cache: 'no-store' })
  if (response.status === 401) return null
  return validateUser(await readAccess(response))
}
export async function fetchWithCsrf(path: string, options: RequestInit): Promise<Response> {
  const csrfResponse = await fetch('/api/v1/auth/csrf', { signal: options.signal, cache: 'no-store' })
  const csrf = await readAccess<{ headerName: string; token: string }>(csrfResponse)
  const headers = new Headers(options.headers)
  headers.set(csrf.headerName, csrf.token)
  return fetch(path, { ...options, headers, cache: 'no-store' })
}
export async function login(username: string, password: string): Promise<CurrentUser> {
  const response = await fetchWithCsrf('/api/v1/auth/login', { method: 'POST', body: new URLSearchParams({ username, password }) })
  if (response.status === 401) throw new Error('아이디 또는 비밀번호를 확인해 주세요.')
  await readAccess(response)
  const user = await getCurrentUser()
  if (!user) throw new Error('로그인 세션을 확인하지 못했습니다. 다시 로그인해 주세요.')
  return user
}
export async function logout(): Promise<void> { await readAccess(await fetchWithCsrf('/api/v1/auth/logout', { method: 'POST' })) }
async function authenticate(path: string, values: object): Promise<CurrentUser> {
  const response = await fetchWithCsrf(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
  return validateUser(await readAccess(response))
}
export const enterTeamCode = (code: string, password: string) => authenticate('/api/v1/auth/team-code', { code, password })
export const selectTeam = (teamId: number) => authenticate('/api/v1/auth/team', { teamId })
export const acceptInvitation = (token: string, credentials?: { username: string; password: string }) => authenticate('/api/v1/auth/invitation/accept', { token, ...credentials })
export async function inspectInvitation(token: string, signal?: AbortSignal) {
  return readAccess<{ team: TeamDisplay; label: string; expiresAt: string; role: ManagerRole }>(await fetchWithCsrf('/api/v1/auth/invitation/inspect', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
  }))
}
export function identityOf(user: CurrentUser | null): string {
  return user ? `${user.authType}:${user.username ?? ''}:${user.team?.id ?? ''}:${user.role}:${user.serviceAdmin}` : 'anonymous'
}
