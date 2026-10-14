export type TeamRole = 'DIRECTOR' | 'COACH' | 'MEMBER'
export type ManagerRole = Exclude<TeamRole, 'MEMBER'>
export const roleLabels: Record<TeamRole, string> = { DIRECTOR: '감독', COACH: '코치', MEMBER: '조회 회원' }

type TeamIdentity = { authType: string; role: string; team: { status: string } | null } | null | undefined

// 선수 명단의 직책과 서비스 관리 권한은 팀의 개인 계정 권한을 대신하지 않는다.
export function canEditTeam(user: TeamIdentity): boolean {
  return user?.authType === 'ACCOUNT' && user.team?.status === 'ACTIVE'
    && (user.role === 'DIRECTOR' || user.role === 'COACH')
}

export function canManageCoaches(user: TeamIdentity): boolean {
  return canEditTeam(user) && user?.role === 'DIRECTOR'
}
