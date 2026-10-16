import { AccessRequestError, fetchWithCsrf, readAccess } from './api.ts'

export interface RecoveryAccount { id: number; username: string; teams: { teamId: number; teamName: string; role: 'DIRECTOR' | 'COACH' }[] }
export interface ResetLinkInfo { username: string; expiresAt: string }
export interface IssuedResetLink extends ResetLinkInfo { token: string }
export async function findRecoveryAccounts(query: string, signal?: AbortSignal): Promise<RecoveryAccount[]> {
  return readAccess(await fetch(`/api/v1/service/account-recovery/accounts?${new URLSearchParams({ query })}`, { signal, cache: 'no-store' }))
}
export async function issueResetLink(accountId: number): Promise<IssuedResetLink> {
  return readAccess(await fetchWithCsrf(`/api/v1/service/account-recovery/${accountId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identityVerified: true }) }))
}
export async function inspectResetLink(token: string, signal?: AbortSignal): Promise<ResetLinkInfo> {
  return readAccess(await fetchWithCsrf('/api/v1/auth/password-reset/inspect', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }))
}
export async function completePasswordReset(token: string, newPassword: string): Promise<void> {
  await readAccess(await fetchWithCsrf('/api/v1/auth/password-reset/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, newPassword }) }))
}
export function resetPasswordValidation(password: string, confirmation: string): string {
  if (Array.from(password).length < 12) return '새 비밀번호는 12자 이상으로 입력해 주세요.'
  if (new TextEncoder().encode(password).length > 72) return '새 비밀번호는 UTF-8 기준 72바이트 이내로 입력해 주세요.'
  if (password !== confirmation) return '새 비밀번호와 확인 입력이 일치하지 않아요.'
  return ''
}
export function resetLinkUrl(origin: string, pathname: string, token: string): string {
  return `${origin}${pathname}#reset=${encodeURIComponent(token)}`
}
export function resetRequestMessage(cause: unknown, action: 'inspect' | 'issue' | 'complete'): string {
  if (cause instanceof AccessRequestError) {
    if (cause.status === 429) return '시도 횟수가 많아요. 잠시 기다린 뒤 다시 시도해 주세요.'
    if (cause.code === 'RESET_LINK_INVALID') return '사용할 수 없는 복구 링크예요. 이미 사용했거나 만료되었을 수 있어요. 서비스 관리자에게 새 링크를 요청해 주세요.'
    if (cause.code === 'PASSWORD_UNCHANGED') return '이전 비밀번호와 다른 새 비밀번호를 입력해 주세요.'
    if (cause.code === 'INVALID_NEW_PASSWORD') return '새 비밀번호는 12자 이상, UTF-8 기준 72바이트 이내로 입력해 주세요.'
    if (cause.code === 'IDENTITY_VERIFICATION_REQUIRED') return '대상자의 본인 확인을 마친 뒤 다시 발급해 주세요.'
    if (cause.code === 'RECOVERY_ACCOUNT_UNAVAILABLE') return '현재 복구 링크를 발급할 수 없는 계정이에요. 계정과 운영진 권한을 다시 확인해 주세요.'
    if ([401, 403].includes(cause.status)) return '접속 권한을 확인하지 못했어요. 다시 로그인해 주세요.'
  }
  return action === 'complete' ? '변경 결과를 확인하지 못했어요. 자동으로 다시 요청하지 않았어요. 새 비밀번호로 로그인을 확인해 주세요. 로그인이 되지 않으면 서비스 관리자에게 새 링크를 요청해 주세요.'
    : action === 'issue' ? '발급 결과를 확인하지 못했어요. 자동으로 다시 발급하지 않았어요. 다시 발급하면 이전 링크는 사용할 수 없어요.'
      : '복구 링크를 확인하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.'
}
