import { useRef, useState } from 'react'
import { selectTeam } from '../auth/api'
import { roleLabels } from '../auth/permissions'
import type { CurrentUser } from '../auth/api'
import { useEditGuard } from '../../app/LeaveGuard'
import { accessMessage, isSessionFailure } from './AccessUi'

export function MyTeams({ user, onSelected, onSessionExpired, onRefresh }: { user: CurrentUser; onSelected: (user: CurrentUser) => void; onSessionExpired: () => void; onRefresh: () => void }) {
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  useEditGuard(false, busy !== null)
  async function choose(id: number) {
    if (submitting.current) return
    submitting.current = true; setBusy(id); setError('')
    try { onSelected(await selectTeam(id)) }
    catch (cause) { if (isSessionFailure(cause)) onSessionExpired(); else setError(accessMessage(cause)) }
    finally { submitting.current = false; setBusy(null) }
  }
  const activeTeams = user.teams.filter(team => team.status === 'ACTIVE')
  return <section className="access-section" aria-labelledby="my-teams-title"><div className="section-heading"><div><p className="eyebrow muted">MY TEAMS</p><h2 id="my-teams-title">내 팀 목록</h2></div><button className="secondary-button" disabled={busy !== null} onClick={onRefresh}>소속 다시 확인</button></div>
    <p className="section-description">들어갈 팀을 선택해 주세요. 현재 계정으로 이용할 수 있는 팀만 보여요.</p>
    {error && <p className="form-error access-error" role="alert">{error}</p>}
    {!activeTeams.length ? <div className="empty-state"><h3>아직 들어갈 팀이 없어요.</h3><p>받은 초대를 확인하거나 서비스 관리자에게 문의해 주세요.</p></div>
      : <div className="access-team-grid">{activeTeams.map(team => <article className="access-panel team-admin-card" key={team.id}><div className="access-panel-heading"><h3>{team.name}</h3><span className="access-status active">{roleLabels[team.role]}</span></div><p>{team.description || '함께 쌓아가는 우리 팀의 기록'}</p><button className="primary-button" disabled={busy !== null} onClick={() => void choose(team.id)}>{busy === team.id ? '팀 선택 중…' : user.team?.id === team.id ? '현재 팀으로 돌아가기' : '이 팀으로 들어가기'}</button></article>)}</div>}
  </section>
}
