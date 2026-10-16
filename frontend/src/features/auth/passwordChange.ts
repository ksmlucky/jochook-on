import { AccessRequestError, fetchWithCsrf, readAccess } from './api.ts'

export function passwordChangeValidation(currentPassword: string, newPassword: string, confirmation: string): string {
  if (!currentPassword) return '현재 비밀번호를 입력해 주세요.'
  if (Array.from(newPassword).length < 12) return '새 비밀번호는 12자 이상으로 입력해 주세요.'
  if (new TextEncoder().encode(newPassword).length > 72) return '새 비밀번호가 너무 길어요. 한글 등 여러 바이트 문자를 포함해 72바이트 이내로 입력해 주세요.'
  if (newPassword === currentPassword) return '현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.'
  if (newPassword !== confirmation) return '새 비밀번호와 확인 입력이 일치하지 않아요.'
  return ''
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await readAccess<void>(await fetchWithCsrf('/api/v1/auth/password/change', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  }))
}

export function passwordChangeError(cause: unknown): string {
  if (cause instanceof AccessRequestError) {
    if (cause.status === 401) return '로그인이 만료되었어요. 다시 로그인해 주세요.'
    if (cause.status === 403) return '개인 계정으로 로그인한 뒤 변경해 주세요. 팀 코드 접속에서는 변경할 수 없어요.'
    if (cause.status === 429) return '시도 횟수가 많아 잠시 기다려야 해요. 아래 대기 시간이 지난 뒤 다시 시도해 주세요.'
    if (cause.code === 'CURRENT_PASSWORD_INCORRECT') return '현재 비밀번호가 맞지 않아요. 확인 후 다시 입력해 주세요.'
    if (cause.code === 'INVALID_NEW_PASSWORD') return '새 비밀번호는 12자 이상, UTF-8 기준 72바이트 이내로 입력해 주세요.'
    if (cause.code === 'PASSWORD_UNCHANGED') return '현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.'
    if (cause.status < 500) return '비밀번호를 변경하지 못했어요. 개인 계정의 접속 상태를 확인하고 다시 시도해 주세요.'
  }
  return '변경 결과를 확인하지 못했어요. 자동으로 다시 요청하지 않았어요. 이미 변경되었을 수 있으니 새 비밀번호로 로그인을 확인한 뒤 다시 진행해 주세요.'
}
