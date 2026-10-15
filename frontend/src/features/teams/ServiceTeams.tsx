import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { TeamDisplay } from '../../app/team'
import { useEditGuard, useLeaveGuard } from '../../app/LeaveGuard'
import { HelpDetails } from '../../app/HelpDetails'
import { AccessRequestError } from '../auth/api'
import { roleLabels } from '../auth/permissions'
import type { ManagerRole } from '../auth/permissions'
import { addTeamMember, createTeam, getServiceTeam, issueInvitation, listServiceTeams, reissueInvitation, removeTeamMember, revokeInvitation } from './api'
import type { CreateTeamRequest, InviteIssued, TeamDetail } from './api'
import { accessMessage, AccessToast, ConfirmAction, isSessionFailure, koreanTime, OneTimeSecret } from './AccessUi'

const teamStatus = { ACTIVE: '운영 중', PENDING: '감독 설정 대기', INACTIVE: '비활성' }
const inviteStatus = { PENDING: '초대 대기', ACCEPTED: '참여 완료', REVOKED: '취소됨', EXPIRED: '만료됨' }
type PendingAction = { title: string; description: string; label: string; danger?: boolean; run: () => Promise<void> }
type Secret = { issued: InviteIssued; teamName: string }
export function ServiceTeams({ onSessionExpired, onMembershipChanged }: { onSessionExpired: () => void; onMembershipChanged: () => Promise<void> }) {
  const [teams, setTeams] = useState<TeamDisplay[] | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [detail, setDetail] = useState<TeamDetail | null>(null)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [secret, setSecret] = useState<Secret | null>(null)
  const [action, setAction] = useState<PendingAction | null>(null)
  const [memberUsername, setMemberUsername] = useState('')
  const [inviteLabel, setInviteLabel] = useState('')
  const [memberRole, setMemberRole] = useState<ManagerRole>('COACH')
  const [inviteRole, setInviteRole] = useState<ManagerRole>('COACH')
  const submitting = useRef(false)
  const alive = useRef(true)
  const guard = useLeaveGuard()
  useEditGuard(!!secret || !!memberUsername || !!inviteLabel, busy)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    Promise.all([listServiceTeams(controller.signal), selected ? getServiceTeam(selected, controller.signal) : Promise.resolve(null)])
      .then(([list, item]) => { if (!controller.signal.aborted) { setTeams(list); setDetail(item) } })
      .catch(cause => { if (!controller.signal.aborted) { if (isSessionFailure(cause)) onSessionExpired(); else setError(accessMessage(cause)) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [selected, revision, onSessionExpired])
  async function navigate(destination: number | 'create' | null) {
    if (!await guard.confirmLeave()) return
    setSecret(null); setMemberUsername(''); setInviteLabel(''); setMemberRole('COACH'); setInviteRole('COACH'); setError(''); setDetail(null)
    setCreating(destination === 'create'); setSelected(typeof destination === 'number' ? destination : null)
  }
  async function perform(work: () => Promise<void>) {
    if (submitting.current) return
    submitting.current = true; setBusy(true); setError(''); setAction(null)
    try { await work(); if (alive.current) setRevision(value => value + 1) }
    catch (cause) {
      if (alive.current) { if (isSessionFailure(cause)) onSessionExpired(); else setError(`${accessMessage(cause)} 처리 결과가 불확실하다면 최신 상태를 먼저 확인해 주세요.`) }
    } finally { submitting.current = false; if (alive.current) setBusy(false) }
  }
  function showInvite(issued: InviteIssued, teamName: string) { if (alive.current) { setSecret({ issued, teamName }); setNotice('운영진 초대를 발급했습니다. 지정한 운영진에게만 전달해 주세요.') } }
  async function addMember(event: FormEvent) {
    event.preventDefault()
    if (!detail || !memberUsername.trim()) return
    const username = memberUsername.trim(), teamId = detail.team.id, role = memberRole
    setAction({ title: `이 계정을 ${roleLabels[role]}으로 지정할까요?`, description: `${username} 계정의 ${detail.team.name} 권한을 ${roleLabels[role]}으로 지정합니다. 기존 권한이 있으면 변경됩니다. 정확한 로그인 아이디인지 확인해 주세요.`, label: `${roleLabels[role]} 지정`, run: async () => { await addTeamMember(teamId, username, role); if (alive.current) { setMemberUsername(''); setNotice(`${roleLabels[role]} 권한을 지정했습니다.`); await onMembershipChanged() } } })
  }
  async function invite(event: FormEvent) {
    event.preventDefault()
    if (!detail || !inviteLabel.trim()) return
    const teamId = detail.team.id, teamName = detail.team.name, label = inviteLabel.trim(), role = inviteRole
    setAction({ title: `${roleLabels[role]} 초대를 발급할까요?`, description: `${label} 대상으로 ${teamName}의 ${roleLabels[role]} 초대를 발급합니다. 24시간 동안 한 번 사용할 수 있습니다.`, label: '초대 발급', run: async () => { const issued = await issueInvitation(teamId, label, role); if (alive.current) { setInviteLabel(''); showInvite(issued, teamName) } } })
  }
  const visibleTeams = teams?.filter(team => `${team.name} ${team.description ?? ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) ?? []
  return <section className="access-section" aria-labelledby="service-teams-title">
    <div className="section-heading"><div><p className="eyebrow muted">SERVICE ADMIN</p><h2 id="service-teams-title">{creating ? '새 팀 만들기' : detail ? '운영진 지정 관리' : '서비스 팀 관리'}</h2></div>
      {(creating || selected !== null || secret) ? <button className="secondary-button" disabled={busy} onClick={() => void navigate(null)}>팀 목록으로</button> : <button className="primary-button" disabled={busy} onClick={() => void navigate('create')}>＋ 팀 생성</button>}</div>
    <p className="section-description">팀을 만들고 운영진을 지정해요. 선수·경기·코드 관리는 해당 팀의 운영 권한이 있어야 해요.</p>
    <AccessToast message={notice} clear={() => setNotice('')} />
    {error && <div className="access-error" role="alert"><p>{error}</p><button className="secondary-button" disabled={busy} onClick={() => setRevision(value => value + 1)}>최신 상태 확인</button></div>}
    {secret ? <OneTimeSecret invite title={`${secret.teamName} ${roleLabels[secret.issued.role]} 초대가 준비됐어요.`} value={`${window.location.origin}${window.location.pathname}#invite=${encodeURIComponent(secret.issued.token)}`}
      expiresAt={secret.issued.expiresAt} onClose={() => setSecret(null)} />
      : creating ? <CreateTeamForm onSessionExpired={onSessionExpired} onCreated={result => {
        setCreating(false); setSelected(result.team.id); setRevision(value => value + 1)
        if (result.invitation) showInvite(result.invitation, result.team.name)
        else setNotice(result.replayed ? '이미 처리된 팀 생성 결과를 확인했습니다. 초대 원문이 필요하면 상세에서 재발급해 주세요.' : '팀과 최초 감독을 등록했습니다.')
      }} /> : loading ? <p className="save-notice" role="status">팀 정보 불러오는 중…</p>
        : selected !== null && detail ? <>
          <div className="access-team-banner"><strong>{detail.team.name}</strong><span>{detail.team.description || '구분 설명 없음'}</span><small>{teamStatus[detail.team.status]}</small></div>
          <section className="access-panel"><h3>지정된 감독 · 코치 · 조회 계정</h3><p className="access-note">팀에는 감독이 최소 한 명 필요해요. 마지막 감독을 해제하거나 코치로 바꾸려면 새 감독을 먼저 지정해 주세요.</p>
            <HelpDetails title="권한별로 할 수 있는 일"><ul><li>감독은 코치를 관리하고 선수·경기 기록을 수정해요.</li><li>코치는 선수·경기 기록을 수정해요.</li><li>조회 계정은 팀의 기록을 볼 수 있어요.</li></ul></HelpDetails>
            {!detail.members.length ? <p className="access-empty">아직 지정된 계정이 없습니다.</p> : <ul className="access-member-list">{detail.members.map(member => <li key={member.id}><div><strong>{member.username}</strong><small>{roleLabels[member.role]} · {member.active ? '활성' : '해제됨'}</small></div>
              {member.active && <button className="danger-button" disabled={busy || (member.role === 'DIRECTOR' && detail.members.filter(m => m.active && m.role === 'DIRECTOR').length <= 1)} onClick={() => setAction({ title: '이 계정의 팀 소속을 해제할까요?', description: `${member.username} 계정이 ${detail.team.name}에 접근할 수 없게 됩니다. 다른 팀의 소속에는 영향을 주지 않습니다.`, label: '소속 해제', danger: true, run: async () => { await removeTeamMember(detail.team.id, member.id); if (alive.current) { setNotice('팀 소속을 해제했습니다.'); await onMembershipChanged() } } })}>소속 해제</button>}</li>)}</ul>}
            <form className="access-inline-form" onSubmit={addMember}><label>기존 계정 로그인 아이디<input required maxLength={40} autoComplete="off" autoCapitalize="none" spellCheck={false} value={memberUsername} disabled={busy} onChange={event => setMemberUsername(event.target.value)} /></label><label className="access-role-field">지정할 권한<select value={memberRole} disabled={busy} onChange={event => setMemberRole(event.target.value as ManagerRole)}><option value="COACH">코치</option><option value="DIRECTOR">감독</option></select></label><button className="secondary-button" disabled={busy}>권한 지정 · 변경</button></form>
          </section>
          <section className="access-panel"><h3>신규 운영진 초대</h3><p className="access-note">초대는 24시간 동안 한 번만 사용할 수 있어요. 표시명은 구분용 메모이니 링크는 본인에게 직접 전달해 주세요.</p>
            <form className="access-inline-form" onSubmit={invite}><label>초대 대상 표시명<input required maxLength={60} autoComplete="off" value={inviteLabel} disabled={busy} onChange={event => setInviteLabel(event.target.value)} /></label><label className="access-role-field">초대 권한<select value={inviteRole} disabled={busy} onChange={event => setInviteRole(event.target.value as ManagerRole)}><option value="COACH">코치</option><option value="DIRECTOR">감독</option></select></label><button className="primary-button" disabled={busy}>{busy ? '처리 중…' : '새 초대 발급'}</button></form>
            {!detail.invitations.length ? <p className="access-empty">발급한 초대가 없습니다.</p> : <ul className="access-member-list">{detail.invitations.map(invitation => <li key={invitation.id}><div><strong>{invitation.label}</strong><small>{roleLabels[invitation.role]} · {inviteStatus[invitation.status]} · {koreanTime(invitation.expiresAt)}</small></div>
              {invitation.status !== 'ACCEPTED' && <div className="access-actions compact"><button className="secondary-button" disabled={busy} onClick={() => setAction({ title: '초대를 재발급할까요?', description: '이전에 발급한 링크는 더 이상 사용할 수 없습니다. 새로운 링크를 지정한 운영진에게 개인적으로 전달해 주세요.', label: '초대 재발급', run: async () => showInvite(await reissueInvitation(detail.team.id, invitation.id), detail.team.name) })}>재발급</button>
                {invitation.status === 'PENDING' && <button className="danger-button" disabled={busy} onClick={() => setAction({ title: '이 초대를 취소할까요?', description: '이 링크로 운영진 계정을 활성화할 수 없게 됩니다.', label: '초대 취소', danger: true, run: async () => { await revokeInvitation(detail.team.id, invitation.id); setNotice('운영진 초대를 취소했습니다.') } })}>취소</button>}</div>}</li>)}</ul>}
          </section>
        </> : !selected && teams ? <>
          <label className="access-search">팀명 / 구분 설명 검색<input value={query} onChange={event => setQuery(event.target.value)} placeholder="팀 이름 또는 지역" /></label>
          {!teams.length ? <div className="empty-state"><h3>아직 만든 팀이 없습니다.</h3><p>팀을 만들고 처음 운영할 사람을 지정해 주세요.</p></div> : !visibleTeams.length ? <p className="access-empty">검색 조건에 맞는 팀이 없습니다.</p>
            : <div className="access-team-grid">{visibleTeams.map(team => <article className="access-panel team-admin-card" key={team.id}><div className="access-panel-heading"><h3>{team.name}</h3><span className={`access-status ${team.status === 'ACTIVE' ? 'active' : ''}`}>{teamStatus[team.status]}</span></div><p>{team.description || '구분 설명 없음'}</p><button className="secondary-button" onClick={() => void navigate(team.id)}>운영진 지정 관리</button></article>)}</div>}
        </> : null}
    {action && <ConfirmAction title={action.title} description={action.description} confirmLabel={action.label} danger={action.danger} onCancel={() => setAction(null)} onConfirm={() => void perform(action.run)} />}
  </section>
}

function CreateTeamForm({ onCreated, onSessionExpired }: { onCreated: (result: Awaited<ReturnType<typeof createTeam>>) => void; onSessionExpired: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [assignment, setAssignment] = useState<'EXISTING' | 'INVITE'>('INVITE')
  const [username, setUsername] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const savedRequest = useRef<CreateTeamRequest | null>(null)
  const submitting = useRef(false)
  const alive = useRef(true)
  useEditGuard(!!(name || description || username || label), busy)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  function prepare(event: FormEvent) { event.preventDefault(); if (!submitting.current) setConfirm(true) }
  async function save() {
    if (submitting.current) return
    submitting.current = true; setBusy(true); setError(''); setConfirm(false)
    if (!savedRequest.current) savedRequest.current = { requestId: crypto.randomUUID(), name: name.trim(), description: description.trim() || null, assignmentType: assignment, ...(assignment === 'EXISTING' ? { username: username.trim() } : { inviteLabel: label.trim() }) }
    try { const result = await createTeam(savedRequest.current); if (alive.current) { setName(''); setDescription(''); setUsername(''); setLabel(''); onCreated(result) } }
    catch (cause) {
      if (!alive.current) return
      if (isSessionFailure(cause)) onSessionExpired()
      else {
        setError(accessMessage(cause))
        if (!(cause instanceof AccessRequestError) || cause.status >= 500) setUncertain(true)
        else { savedRequest.current = null; setUncertain(false) }
      }
    } finally { submitting.current = false; if (alive.current) setBusy(false) }
  }
  return <form className="access-panel access-form" onSubmit={prepare} aria-busy={busy}>
    <h3>팀과 첫 감독 등록</h3><p>감독은 코치를 임명하고 팀의 기록을 관리해요.</p>
    <fieldset disabled={busy || uncertain}><label>팀명 <span>필수 · 2~40자</span><input minLength={2} maxLength={40} required value={name} onChange={event => setName(event.target.value)} /></label>
      <label>지역 / 구분 설명 <span>선택 · 40자 이내</span><input maxLength={40} value={description} onChange={event => setDescription(event.target.value)} /></label>
      <p className="field-help">같은 이름의 팀이 있다면 지역이나 구분 설명을 적어 주세요.</p>
      <div className="access-assignment-options" role="group" aria-label="최초 감독 지정 방식"><label><input type="radio" name="assignment" checked={assignment === 'EXISTING'} onChange={() => setAssignment('EXISTING')} />기존 계정을 감독으로 지정</label><label><input type="radio" name="assignment" checked={assignment === 'INVITE'} onChange={() => setAssignment('INVITE')} />새 감독 초대</label></div>
      {assignment === 'EXISTING' ? <><label>정확한 로그인 아이디 <span>필수</span><input required maxLength={40} autoComplete="off" autoCapitalize="none" spellCheck={false} value={username} onChange={event => setUsername(event.target.value)} /></label><p className="field-help">초대 수락 없이 이 계정에 감독 권한이 바로 생겨요. 아이디를 꼭 확인해 주세요.</p></>
        : <><label>지정 대상 표시명 <span>필수 · 구분용 메모</span><input required maxLength={60} value={label} onChange={event => setLabel(event.target.value)} /></label><p className="field-help">초대받은 감독이 직접 계정을 만들어요. 링크는 해당 감독에게만 전달해 주세요.</p></>}
    </fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}
    {uncertain && <p className="access-warning"><strong>팀이 만들어졌는지 확인해 주세요.</strong><br />팀 목록을 보거나 아래 버튼을 눌러 확인할 수 있어요. 버튼을 다시 눌러도 팀이 중복 생성되지는 않아요.</p>}
    <button className="primary-button" disabled={busy}>{busy ? '등록 중…' : uncertain ? '팀 생성 결과 확인' : assignment === 'EXISTING' ? '팀 생성 · 감독 지정' : '팀 생성 · 감독 초대'}</button>
    {confirm && <ConfirmAction title="팀과 최초 감독을 등록할까요?" description={assignment === 'EXISTING' ? `${name.trim()} 팀의 감독 권한을 ${username.trim()} 계정에 부여합니다. 정확한 아이디인지 확인해 주세요.` : `${name.trim()} 팀을 만들고 ${label.trim()} 대상으로 24시간 동안 유효한 감독 초대를 발급합니다.`} confirmLabel={uncertain ? '생성 결과 확인' : '팀 등록'} onConfirm={() => void save()} onCancel={() => setConfirm(false)} />}
  </form>
}
