import { fetchWithCsrf, readAccess } from '../auth/api'
import { readTeamJson, teamFetch } from '../auth/teamRequest'
import type { TeamDisplay } from '../../app/team'
import type { ManagerRole, TeamRole } from '../auth/permissions'

export interface TeamMember { id: number; username: string; role: TeamRole; active: boolean }
export interface TeamInvitation { id: number; label: string; role: ManagerRole; status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'; expiresAt: string }
export interface InviteIssued extends TeamInvitation { token: string }
export interface TeamDetail { team: TeamDisplay; members: TeamMember[]; invitations: TeamInvitation[] }
export interface CreateTeamRequest { requestId: string; name: string; description: string | null; assignmentType: 'EXISTING' | 'INVITE'; username?: string; inviteLabel?: string }
export interface CreateTeamResult { team: TeamDisplay; invitation: InviteIssued | null; replayed: boolean }
export interface CodeState { status: 'NONE' | 'ACTIVE' | 'REVOKED' | 'EXPIRED'; version: number; issuedAt: string | null; expiresAt: string | null }
export interface CodeIssued extends CodeState { code: string; password: string }
export interface CodeHistoryEntry { id: number; action: 'ISSUED' | 'ROTATED' | 'REVOKED'; actorUsername: string; version: number; occurredAt: string; expiresAt: string | null }
const json = (method: string, data: object): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
export async function listServiceTeams(signal?: AbortSignal): Promise<TeamDisplay[]> { return readAccess(await fetch('/api/v1/service/teams', { signal, cache: 'no-store' })) }
export async function getServiceTeam(id: number, signal?: AbortSignal): Promise<TeamDetail> { return readAccess(await fetch(`/api/v1/service/teams/${id}`, { signal, cache: 'no-store' })) }
export async function createTeam(data: CreateTeamRequest): Promise<CreateTeamResult> { return readAccess(await fetchWithCsrf('/api/v1/service/teams', json('POST', data))) }
export async function addTeamMember(teamId: number, username: string, role: ManagerRole): Promise<TeamDetail> { return readAccess(await fetchWithCsrf(`/api/v1/service/teams/${teamId}/members`, json('POST', { username, role }))) }
export async function removeTeamMember(teamId: number, membershipId: number): Promise<void> { await readAccess(await fetchWithCsrf(`/api/v1/service/teams/${teamId}/members/${membershipId}`, { method: 'DELETE' })) }
export async function issueInvitation(teamId: number, label: string, role: ManagerRole): Promise<InviteIssued> { return readAccess(await fetchWithCsrf(`/api/v1/service/teams/${teamId}/invitations`, json('POST', { label, role }))) }
export async function reissueInvitation(teamId: number, inviteId: number): Promise<InviteIssued> { return readAccess(await fetchWithCsrf(`/api/v1/service/teams/${teamId}/invitations/${inviteId}/reissue`, { method: 'POST' })) }
export async function revokeInvitation(teamId: number, inviteId: number): Promise<void> { await readAccess(await fetchWithCsrf(`/api/v1/service/teams/${teamId}/invitations/${inviteId}`, { method: 'DELETE' })) }
async function readCode<T extends CodeState>(response: Response): Promise<T> { if (!response.ok) return readAccess(response); return readTeamJson<T>(response) }
export async function getTeamCode(signal?: AbortSignal): Promise<CodeState> { return readCode(await teamFetch('/api/v1/team/code', { signal })) }
export async function getTeamCodeHistory(signal?: AbortSignal): Promise<CodeHistoryEntry[]> {
  const response = await teamFetch('/api/v1/team/code/history?limit=20', { signal })
  if (!response.ok) return readAccess(response)
  return readTeamJson<CodeHistoryEntry[]>(response)
}
export async function issueTeamCode(version: number): Promise<CodeIssued> { return readCode(await teamFetch('/api/v1/team/code', json('POST', { version }))) }
export async function revokeTeamCode(version: number): Promise<CodeState> { return readCode(await teamFetch('/api/v1/team/code', json('DELETE', { version }))) }

async function coachRequest<T>(path = '', options: RequestInit = {}): Promise<T> {
  const response = await teamFetch(`/api/v1/team/coaches${path}`, options)
  if (!response.ok || response.status === 204) return readAccess(response)
  return readTeamJson<T>(response)
}
export const getCoaches = (signal?: AbortSignal) => coachRequest<TeamDetail>('', { signal })
export const appointCoach = (username: string, signal?: AbortSignal) => coachRequest<TeamDetail>('/members', { ...json('POST', { username }), signal })
export const demoteCoach = (id: number, signal?: AbortSignal) => coachRequest<void>(`/members/${id}`, { method: 'DELETE', signal })
export const inviteCoach = (label: string, signal?: AbortSignal) => coachRequest<InviteIssued>('/invitations', { ...json('POST', { label }), signal })
export const reissueCoachInvitation = (id: number, signal?: AbortSignal) => coachRequest<InviteIssued>(`/invitations/${id}/reissue`, { method: 'POST', signal })
export const revokeCoachInvitation = (id: number, signal?: AbortSignal) => coachRequest<void>(`/invitations/${id}`, { method: 'DELETE', signal })
