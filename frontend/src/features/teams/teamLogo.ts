import { readAccess } from '../auth/api'
import { assertTeamScope, captureTeamScope, readTeamBlob, teamFetch } from '../auth/teamRequest'

export const TEAM_LOGO_CHANGED = 'jochookon:team-logo-changed'
const endpoint = '/api/v1/teams/current/logo'
const requests = new WeakMap<AbortController, Promise<Blob | null>>()

export async function getTeamLogo(teamId: number): Promise<Blob | null> {
  const scope = captureTeamScope()
  if (scope.teamId !== teamId) throw new DOMException('다른 팀의 로고 요청을 취소했어요.', 'AbortError')
  let request = requests.get(scope.controller)
  if (!request) {
    request = teamFetch(endpoint, {}, scope).then(async response => {
      if (response.status === 404) return null
      if (!response.ok) return readAccess<never>(response)
      return readTeamBlob(response)
    }).catch(error => { requests.delete(scope.controller); throw error })
    requests.set(scope.controller, request)
  }
  const blob = await request
  assertTeamScope(scope)
  return blob
}

export async function updateTeamLogo(file: File | null): Promise<void> {
  const scope = captureTeamScope()
  const body = new FormData()
  if (file) body.append('file', file)
  await readAccess(await teamFetch(endpoint, { method: file ? 'PUT' : 'DELETE', ...(file ? { body } : {}) }, scope))
  assertTeamScope(scope)
  requests.delete(scope.controller)
  window.dispatchEvent(new CustomEvent(TEAM_LOGO_CHANGED, { detail: scope.teamId }))
}

export function validateLogoFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!['image/png', 'image/jpeg'].includes(file.type)) return 'PNG 또는 JPG 이미지를 선택해 주세요.'
  if (!file.size || file.size > 2 * 1024 * 1024) return '2MB 이하의 이미지를 선택해 주세요.'
  return null
}
