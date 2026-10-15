import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { TeamDisplay } from '../../app/team'
import { useEditGuard } from '../../app/LeaveGuard'
import { HelpDetails } from '../../app/HelpDetails'
import { roleLabels } from '../auth/permissions'
import { appointCoach, demoteCoach, getCoaches, inviteCoach, reissueCoachInvitation, revokeCoachInvitation } from './api'
import type { InviteIssued, TeamDetail } from './api'
import { accessMessage, AccessToast, ConfirmAction, isSessionFailure, koreanTime, OneTimeSecret } from './AccessUi'

const inviteStatuses = { PENDING: '초대 대기', ACCEPTED: '참여 완료', REVOKED: '취소됨', EXPIRED: '만료됨' }
type Action = { title: string; description: string; label: string; danger?: boolean; run: (signal: AbortSignal) => Promise<void> }

export function CoachManager({ team, onSessionExpired }: { team: TeamDisplay; onSessionExpired: () => void }) {
  const [detail, setDetail] = useState<TeamDetail | null>(null)
  const [username, setUsername] = useState('')
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [secret, setSecret] = useState<InviteIssued | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const submitting = useRef(false)
  const lifetime = useRef<AbortController | null>(null)
  useEditGuard(!!username || !!label || !!secret, busy)
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller
    return () => controller.abort()
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    getCoaches(controller.signal).then(result => { if (!controller.signal.aborted) setDetail(result) })
      .catch(cause => {
        if (controller.signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') return
        if (isSessionFailure(cause)) onSessionExpired()
        else setError(accessMessage(cause))
      }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [revision, onSessionExpired])
  async function perform(next: Action) {
    const signal = lifetime.current?.signal
    if (submitting.current || !signal || signal.aborted) return
    submitting.current = true; setBusy(true); setError(''); setAction(null)
    try { await next.run(signal); if (!signal.aborted) setRevision(value => value + 1) }
    catch (cause) {
      if (signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') return
      if (isSessionFailure(cause)) onSessionExpired()
      else setError(`${accessMessage(cause)} 처리 결과가 불확실하면 최신 상태를 먼저 확인해 주세요.`)
    } finally { submitting.current = false; if (!signal.aborted) setBusy(false) }
  }
  function add(event: FormEvent) {
    event.preventDefault()
    const account = username.trim()
    if (!account) return
    setAction({ title: '이 계정을 코치로 임명할까요?', description: `${account} 계정에 ${team.name}의 선수·경기 기록 등록과 수정 권한을 부여합니다. 선수 이름이 아닌 정확한 로그인 아이디를 확인해 주세요.`, label: '코치 임명', run: async signal => {
      await appointCoach(account, signal)
      if (!signal.aborted) { setUsername(''); setNotice('코치를 임명했습니다.') }
    } })
  }
  function invite(event: FormEvent) {
    event.preventDefault()
    const memo = label.trim()
    if (!memo) return
    setAction({ title: '새 코치 초대를 만들까요?', description: `${memo} 대상으로 24시간 동안 한 번 사용할 수 있는 초대 링크를 만듭니다. 링크는 지정한 코치에게만 전달해 주세요.`, label: '코치 초대 발급', run: async signal => {
      const issued = await inviteCoach(memo, signal)
      if (!signal.aborted) { setLabel(''); setSecret(issued); setNotice('코치 초대를 발급했습니다.') }
    } })
  }
  const invitations = detail?.invitations.filter(invitation => invitation.role === 'COACH') ?? []
  return <section className="access-section" aria-labelledby="coach-manager-title">
    <div className="section-heading"><div><p className="eyebrow muted">{team.name} · DIRECTOR</p><h2 id="coach-manager-title">코치 관리</h2></div>
      <button className="secondary-button" disabled={busy || loading} onClick={() => setRevision(value => value + 1)}>최신 상태 확인</button></div>
    <p className="section-description">코치를 임명하거나 조회 회원으로 변경해요.</p>
    <p className="access-note">선수·경기 기록은 감독과 코치만 수정할 수 있어요. 선수 명단의 직책을 바꿔도 로그인 권한은 바뀌지 않아요.</p>
    <AccessToast message={notice} clear={() => setNotice('')} />
    {error && <p className="form-error access-error" role="alert">{error}</p>}
    {secret ? <OneTimeSecret invite title={`${team.name} 코치 초대가 준비됐어요.`} value={`${window.location.origin}${window.location.pathname}#invite=${encodeURIComponent(secret.token)}`} expiresAt={secret.expiresAt} onClose={() => setSecret(null)} />
      : loading ? <p className="save-notice" role="status">팀 권한 불러오는 중…</p>
        : detail && <>
          <section className="access-panel"><h3>팀 계정과 권한</h3>
            <HelpDetails title="권한 변경 안내"><ul><li>조회 회원으로 바꿔도 기존 경기 기록은 유지돼요.</li><li>감독 권한은 서비스 관리자가 변경할 수 있어요.</li></ul></HelpDetails>
            {!detail.members.length ? <p className="access-empty">지정된 계정이 없습니다.</p> : <ul className="access-member-list">{detail.members.map(member => <li key={member.id}>
              <div><strong>{member.username}</strong><small>{roleLabels[member.role]} · {member.active ? '활성' : '소속 해제됨'}</small></div>
              {member.active && member.role === 'COACH' && <button className="danger-button" disabled={busy} onClick={() => setAction({ title: '코치를 조회 회원으로 변경할까요?', description: `${member.username} 계정의 ${team.name} 기록 수정 권한을 해제합니다. 이 팀의 기록 조회는 계속할 수 있습니다.`, label: '조회 회원으로 변경', danger: true, run: async signal => {
                await demoteCoach(member.id, signal)
                if (!signal.aborted) setNotice('코치를 조회 회원으로 변경했습니다.')
              } })}>조회 회원으로 변경</button>}
            </li>)}</ul>}
            <form className="access-inline-form" onSubmit={add}><label>코치로 지정할 로그인 아이디<input required maxLength={40} autoComplete="off" autoCapitalize="none" spellCheck={false} value={username} disabled={busy} onChange={event => setUsername(event.target.value)} /></label><button className="secondary-button" disabled={busy}>코치 임명</button></form>
          </section>
          <section className="access-panel"><h3>계정이 없는 코치 초대</h3><p className="access-note">초대받은 코치가 직접 계정을 만들어요. 링크는 24시간 동안 한 번만 사용할 수 있어요.</p>
            <form className="access-inline-form" onSubmit={invite}><label>초대 대상 표시명 · 구분용 메모<input required maxLength={60} autoComplete="off" value={label} disabled={busy} onChange={event => setLabel(event.target.value)} /></label><button className="primary-button" disabled={busy}>{busy ? '처리 중…' : '코치 초대 만들기'}</button></form>
            {!invitations.length ? <p className="access-empty">발급한 코치 초대가 없습니다.</p> : <ul className="access-member-list">{invitations.map(invitation => <li key={invitation.id}>
              <div><strong>{invitation.label}</strong><small>코치 · {inviteStatuses[invitation.status]} · {koreanTime(invitation.expiresAt)}</small></div>
              {invitation.status !== 'ACCEPTED' && <div className="access-actions compact"><button className="secondary-button" disabled={busy} onClick={() => setAction({ title: '코치 초대를 재발급할까요?', description: '기존 링크는 사용할 수 없게 됩니다. 새 링크는 지정한 코치에게만 전달해 주세요.', label: '초대 재발급', run: async signal => {
                const issued = await reissueCoachInvitation(invitation.id, signal)
                if (!signal.aborted) { setSecret(issued); setNotice('코치 초대를 재발급했습니다.') }
              } })}>재발급</button>
                {invitation.status === 'PENDING' && <button className="danger-button" disabled={busy} onClick={() => setAction({ title: '코치 초대를 취소할까요?', description: '이 링크로는 코치로 참여할 수 없게 됩니다.', label: '초대 취소', danger: true, run: async signal => {
                  await revokeCoachInvitation(invitation.id, signal)
                  if (!signal.aborted) setNotice('코치 초대를 취소했습니다.')
                } })}>취소</button>}</div>}
            </li>)}</ul>}
          </section>
        </>}
    {action && <ConfirmAction title={action.title} description={action.description} confirmLabel={action.label} danger={action.danger} onCancel={() => setAction(null)} onConfirm={() => void perform(action)} />}
  </section>
}
