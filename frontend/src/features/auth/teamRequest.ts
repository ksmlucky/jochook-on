import { AccessRequestError, fetchWithCsrf, identityOf, SessionExpiredError } from './api'
import type { CurrentUser } from './api'
import { TeamScopeStore } from './teamScope'
import type { TeamRequestScope } from './teamScope'
export type { TeamRequestScope } from './teamScope'

export const ACCESS_CHANGED_EVENT = 'jochookon:access-changed'
const scopes = new TeamScopeStore()
const responseScopes = new WeakMap<Response, TeamRequestScope>()
export function configureTeamAccess(user: CurrentUser | null) {
  scopes.configure(identityOf(user), user?.team?.id ?? null)
}
export function captureTeamScope(): TeamRequestScope {
  const scope = scopes.snapshot()
  if (!scope || !scopes.accepts(scope)) throw new SessionExpiredError()
  return scope
}
export function assertTeamScope(scope: TeamRequestScope) {
  if (!scopes.accepts(scope)) throw new DOMException('이전 팀의 요청을 취소했습니다.', 'AbortError')
}
export function lockTeamAccess(message: string) {
  scopes.invalidate()
  window.dispatchEvent(new CustomEvent<string>(ACCESS_CHANGED_EVENT, { detail: message }))
}
export async function teamFetch(path: string, options: RequestInit = {}, scope = captureTeamScope()): Promise<Response> {
  assertTeamScope(scope)
  const headers = new Headers(options.headers)
  headers.set('X-Team-Id', String(scope.teamId))
  const signal = options.signal ? AbortSignal.any([options.signal, scope.controller.signal]) : scope.controller.signal
  const request = { ...options, headers, signal, cache: 'no-store' as const }
  let response: Response
  try {
    response = await (options.method && !['GET', 'HEAD'].includes(options.method.toUpperCase()) ? fetchWithCsrf(path, request) : fetch(path, request))
  } catch (cause) {
    // CSRF 확인 실패도 팀 접속 오류로 처리하되, 이전 팀의 늦은 오류는 현재 팀을 잠그지 않는다.
    assertTeamScope(scope)
    if (cause instanceof AccessRequestError && (cause.status === 401 || cause.status === 403)) {
      const message = '접속 상태를 확인하지 못해 저장 요청을 보내지 않았습니다. 다시 접속해 주세요.'
      lockTeamAccess(message)
      throw new SessionExpiredError(message)
    }
    throw cause
  }
  assertTeamScope(scope)
  if (response.status === 401 || response.status === 403 || response.status === 409) {
    const error = await response.clone().json().catch(() => null) as { code?: string; message?: string } | null
    assertTeamScope(scope)
    if (response.status === 401 || response.status === 403 || error?.code === 'TEAM_CHANGED') {
      const message = error?.code === 'TEAM_CHANGED' ? '다른 탭에서 팀 또는 접속 방식이 변경되었습니다. 이전 팀의 입력은 저장하지 않았습니다. 접속 상태를 다시 확인해 주세요.'
        : response.status === 403 ? '현재 팀의 접근 권한을 확인할 수 없습니다. 접속 상태를 다시 확인해 주세요.'
          : '팀 접속이 종료되었습니다. 운영진에게 받은 최신 코드 또는 개인 계정으로 다시 접속해 주세요.'
      lockTeamAccess(message)
      throw new SessionExpiredError(message)
    }
  }
  responseScopes.set(response, scope)
  return response
}
export const teamFetchWithCsrf = teamFetch
export async function readTeamJson<T>(response: Response): Promise<T> {
  const result = await response.json() as T
  const scope = responseScopes.get(response)
  if (scope) assertTeamScope(scope)
  return result
}
export async function readTeamBlob(response: Response): Promise<Blob> {
  const result = await response.blob()
  const scope = responseScopes.get(response)
  if (scope) assertTeamScope(scope)
  return result
}
