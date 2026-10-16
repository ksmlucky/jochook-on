import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { SquadSection } from './features/players/SquadSection'
import type { SquadNavigation } from './features/players/SquadSection'
import { MatchSection } from './features/matches/MatchSection'
import { clearAccountRecoveries } from './features/matches/draftRecovery'
import { StatsSection } from './features/stats/StatsSection'
import { LoginForm } from './features/auth/LoginForm'
import { TeamCodeForm } from './features/auth/TeamCodeForm'
import { InvitationPanel } from './features/auth/InvitationPanel'
import { useAuth } from './features/auth/useAuth'
import { identityOf } from './features/auth/api'
import type { CurrentUser } from './features/auth/api'
import { ServiceTeams } from './features/teams/ServiceTeams'
import { TeamCodeManager } from './features/teams/TeamCodeManager'
import { MyTeams } from './features/teams/MyTeams'
import { CoachManager } from './features/teams/CoachManager'
import { canEditTeam, canManageCoaches, roleLabels } from './features/auth/permissions'
import { AccessToast, ConfirmAction } from './features/teams/AccessUi'
import { useLeaveGuard } from './app/LeaveGuard'
import { serviceBrand } from './app/brand'
import { InstallApp } from './features/install/InstallApp'
import { UserGuide } from './features/guide/UserGuide'
import { TournamentSection } from './features/tournaments/TournamentSection'
import { HomeSection } from './features/home/HomeSection'
import { PasswordChangeForm } from './features/auth/PasswordChangeForm'
import { PasswordResetPanel } from './features/auth/PasswordResetPanel'
import { AccountRecoveryManager } from './features/teams/AccountRecoveryManager'
import { consumePasswordResetAddress } from './features/auth/passwordResetAddress'

function takeResetFromAddress() {
  return consumePasswordResetAddress(new URL(window.location.href), address => window.history.replaceState(null, '', address))
}

function takeInvitationFromAddress(): string {
  if (!window.location.hash.startsWith('#invite=')) return ''
  const token = new URLSearchParams(window.location.hash.slice(1)).get('invite') || ''
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#access`)
  return token.length <= 2048 ? token : ''
}
// React StrictMode의 초기화 재실행과 무관하게 원문을 주소에서 즉시 지운다.
let invitationAtLoad = takeInvitationFromAddress()
let resetAtLoad = takeResetFromAddress()
type Page = 'home' | 'dashboard' | 'workspace' | 'code' | 'login' | 'teams' | 'service' | 'code-management' | 'coach-management' | 'password' | 'account-recovery'
type WorkspaceSection = 'players' | 'matches' | 'stats' | 'tournaments' | 'guide'
const workspaceLabels: Record<WorkspaceSection, string> = { players: '선수단', matches: '경기 기록', stats: '선수 기록', tournaments: '대회', guide: '사용 가이드' }

function MenuIcon({ kind }: { kind: WorkspaceSection }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'players' ? <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2" /></> : kind === 'stats' ? <><path d="M4 20h17M7 16V9M12 16V4M17 16v-5" /></> : kind === 'tournaments' ? <><path d="M7 3h10v5a5 5 0 0 1-10 0V3ZM7 5H3v2a4 4 0 0 0 5 4M17 5h4v2a4 4 0 0 1-5 4M12 13v5M8 21h8M9 18h6v3" /></> : kind === 'guide' ? <><path d="M12 5C8 3 5 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-5-1-9 1Z" /><path d="M12 5v15M6 8h3M15 8h3M6 12h3M15 12h3" /></> : <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 11h18M8 15h2M14 15h2M8 18h2" /></>}
  </svg>
}

export function App() {
  const auth = useAuth()
  const guard = useLeaveGuard()
  const squad = useRef<SquadNavigation>(null)
  const [page, setPage] = useState<Page>(() => ['#players', '#matches', '#stats', '#tournaments', '#guide'].includes(window.location.hash) ? 'workspace' : 'home')
  const [section, setSection] = useState<WorkspaceSection>(window.location.hash === '#tournaments' ? 'tournaments' : window.location.hash === '#guide' ? 'guide' : window.location.hash === '#stats' ? 'stats' : window.location.hash === '#matches' ? 'matches' : 'players')
  const [tournamentLink, setTournamentLink] = useState<{ identity: string; id: number } | null>(null)
  const [matchLaunch, setMatchLaunch] = useState<{ identity: string; id: number | 'new'; key: number } | null>(null)
  const launchSequence = useRef(0)
  const managementMenu = useRef<HTMLDetailsElement>(null)
  const [inviteToken, setInviteToken] = useState(invitationAtLoad)
  const [resetToken, setResetToken] = useState<string | null>(resetAtLoad)
  const [workspaceEpoch, setWorkspaceEpoch] = useState(0)
  const [switchToCode, setSwitchToCode] = useState(false)
  const [notice, setNotice] = useState('')
  const [rechecking, setRechecking] = useState(false)
  const user = auth.state.status === 'authenticated' ? auth.state.user : null
  const homePage = user ? user.team ? 'dashboard' : user.serviceAdmin ? 'service' : 'teams' : 'code'
  const requestedPage = page === 'home' || (page === 'workspace' && !user?.team) ? homePage : page
  const isAdmin = canEditTeam(user)
  const isDirector = canManageCoaches(user)
  const activePage = requestedPage === 'coach-management' && !isDirector || requestedPage === 'code-management' && !isAdmin
    || ['service', 'account-recovery'].includes(requestedPage) && !user?.serviceAdmin || requestedPage === 'password' && user?.authType !== 'ACCOUNT' ? homePage : requestedPage
  const team = user?.team
  const identity = `${identityOf(user)}:${workspaceEpoch}`
  const initialTournamentId = tournamentLink?.identity === identity ? tournamentLink.id : null
  const launch = matchLaunch?.identity === identity ? matchLaunch : null
  useEffect(() => { invitationAtLoad = ''; resetAtLoad = null }, [])
  // Make the first workspace entry a real history destination as well.
  useEffect(() => {
    if (team && activePage === 'workspace' && !inviteToken && resetToken === null && !auth.accessIssue) {
      window.history.replaceState(null, '', `#${section}`)
    } else if (team && activePage === 'dashboard' && !inviteToken && resetToken === null && !auth.accessIssue) {
      window.history.replaceState(null, '', '#home')
    }
  }, [team?.id, activePage, section, inviteToken, resetToken, auth.accessIssue])
  useEffect(() => {
    const readAddress = () => {
      const reset = takeResetFromAddress()
      if (reset !== null) { void guard.confirmLeave().then(allowed => { if (allowed) { setInviteToken(''); setResetToken(reset) } }); return }
      const token = takeInvitationFromAddress()
      if (token) { void guard.confirmLeave().then(allowed => { if (allowed) { setResetToken(null); setInviteToken(token) } }); return }
      const target = window.location.hash.slice(1)
      if (!user?.team || auth.accessIssue || !['home', 'players', 'matches', 'stats', 'tournaments', 'guide'].includes(target)) return
      if (activePage === 'workspace' && !inviteToken && resetToken === null && target === section) return
      void guard.confirmLeave().then(allowed => {
        if (allowed) { setResetToken(null); setInviteToken(''); setPage(target === 'home' ? 'dashboard' : 'workspace'); if (target !== 'home') setSection(target as WorkspaceSection); if (target === 'matches') { setTournamentLink(null); setMatchLaunch(null) } }
        else window.history.replaceState(null, '', `#${activePage === 'workspace' ? section : activePage === 'dashboard' ? 'home' : 'access'}`)
      })
    }
    window.addEventListener('hashchange', readAddress)
    return () => window.removeEventListener('hashchange', readAddress)
  }, [guard, user?.team, auth.accessIssue, activePage, section, inviteToken, resetToken])
  function closeManagement() { if (managementMenu.current) managementMenu.current.open = false }
  async function navigate(next: Page) {
    if (!await guard.confirmLeave()) return
    closeManagement(); setResetToken(null); setInviteToken(''); setPage(next)
    window.history.replaceState(null, '', `#${next === 'home' && team ? 'home' : 'access'}`)
    if (next === 'teams') await auth.refresh()
  }
  function signedIn(next: CurrentUser) { auth.signedIn(next); setWorkspaceEpoch(value => value + 1); setPage('home') }
  async function signOut() {
    if (!await guard.confirmLeave('logout')) return
    if (await auth.signOut()) { if (user?.username) clearAccountRecoveries(user.username); setResetToken(null); setInviteToken(''); setPage('code'); setWorkspaceEpoch(value => value + 1) }
  }
  async function codeAccess() {
    if (!await guard.confirmLeave(user?.authType === 'ACCOUNT' ? 'logout' : 'navigate')) return
    closeManagement()
    if (user?.authType === 'ACCOUNT') { setSwitchToCode(true); return }
    setResetToken(null); setInviteToken(''); setPage('code')
  }
  async function confirmCodeAccess() {
    setSwitchToCode(false)
    if (await auth.signOut()) { if (user?.username) clearAccountRecoveries(user.username); setResetToken(null); setInviteToken(''); setPage('code'); setWorkspaceEpoch(value => value + 1) }
  }
  async function recheck() {
    if (!await guard.confirmLeave()) return
    setRechecking(true); setSwitchToCode(false)
    try { await auth.refresh(); setWorkspaceEpoch(value => value + 1); setPage('home') }
    finally { setRechecking(false) }
  }
  async function showSection(event: MouseEvent<HTMLAnchorElement> | null, next: WorkspaceSection) {
    event?.preventDefault()
    if (!user?.team || auth.accessIssue) return
    if (activePage === 'workspace' && !inviteToken && resetToken === null && section === next && !(next === 'matches' && (initialTournamentId !== null || launch !== null))) {
      if (next === 'players' && squad.current && !squad.current.returnToList()) return
    } else if (!await guard.confirmLeave()) return
    closeManagement(); setResetToken(null); setInviteToken(''); setPage('workspace'); setSection(next)
    if (next === 'matches') { setTournamentLink(null); setMatchLaunch(null) }
    if (window.location.hash !== `#${next}`) window.history.pushState(null, '', `#${next}`)
    window.requestAnimationFrame(() => { document.getElementById('app-content')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }) })
  }
  async function openTournamentMatches(id: number) {
    if (!user?.team || auth.accessIssue || !await guard.confirmLeave()) return
    setTournamentLink({ identity, id }); setMatchLaunch(null); closeManagement(); setResetToken(null); setInviteToken(''); setPage('workspace'); setSection('matches')
    if (window.location.hash !== '#matches') window.history.pushState(null, '', '#matches')
    requestAnimationFrame(() => { document.getElementById('app-content')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }) })
  }
  async function openHomeMatch(id: number | 'new') {
    if (!team || auth.accessIssue || (id === 'new' && !isAdmin) || !await guard.confirmLeave()) return
    setTournamentLink(null); setMatchLaunch({ identity, id, key: ++launchSequence.current })
    setPage('workspace'); setSection('matches'); closeManagement()
    window.history.pushState(null, '', '#matches')
    requestAnimationFrame(() => { document.getElementById('app-content')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }) })
  }
  function passwordChanged() {
    if (user?.username) clearAccountRecoveries(user.username)
    auth.signedIn(null); setResetToken(null); setInviteToken(''); setWorkspaceEpoch(value => value + 1); setPage('login')
    window.history.replaceState(null, '', '#access')
    setNotice('비밀번호를 변경했어요. 새 비밀번호로 다시 로그인해 주세요.')
  }
  return <div className={`app-shell${user ? ' has-session' : ' welcome-shell'}`}>
    <a className="skip-link" href="#app-content">주요 화면으로 바로가기</a>
    <header className="site-header">
      <a className="club-brand" href="#access" aria-label={`${serviceBrand.name} 홈`} onClick={event => { event.preventDefault(); void navigate('home') }}>
        <img className="brand-mark" src="/icons/jochook-on.svg" width="44" height="44" alt="" /><span>조축<span className="brand-on">ON</span><small>우리의 축구가 모이는 곳</small></span>
      </a>
      {team && !auth.accessIssue && resetToken === null && <nav className="primary-navigation" aria-label="주요 메뉴">
        {(['players', 'matches', 'stats', 'tournaments', 'guide'] as const).map(item => <a key={item} className={`workspace-nav${activePage === 'workspace' && !inviteToken && section === item ? ' is-current' : ''}`} aria-current={activePage === 'workspace' && !inviteToken && section === item ? 'page' : undefined} href={`#${item}`} onClick={event => void showSection(event, item)}><MenuIcon kind={item} /><span className="workspace-nav-label">{workspaceLabels[item]}</span></a>)}
      </nav>}
      {user ? <div className="account-menu"><span><strong>{user.username || '팀 회원'}</strong><small>{user.authType === 'TEAM_CODE' ? '코드 조회 접속' : `${user.team ? roleLabels[user.role] : '팀 선택 필요'}${user.serviceAdmin ? ' · 서비스관리자' : ''}`}</small></span>
        <button className="secondary-button" onClick={() => void signOut()} disabled={auth.isLoggingOut}>{auth.isLoggingOut ? '종료 중…' : user.authType === 'TEAM_CODE' ? '나가기' : '로그아웃'}</button></div> : <span className="header-note">함께 뛰고, 함께 기록하다</span>}
    </header>
    <main id="app-content" tabIndex={-1}>
      {user && !auth.accessIssue && !inviteToken && resetToken === null && !['code', 'login'].includes(activePage) && <section className="workspace-context" aria-labelledby="workspace-title">
        <div className="context-emblem" aria-hidden="true">{activePage === 'service' ? 'ON' : team?.name.slice(0, 1) || 'ON'}</div>
        <div className="context-copy"><p>{activePage === 'service' ? '서비스 관리' : activePage === 'teams' ? '나의 팀' : '현재 함께하는 팀'}</p><h1 id="workspace-title">{activePage === 'service' ? '팀을 위한 공간을 관리해요' : activePage === 'teams' ? '함께 뛸 팀을 선택하세요' : team?.name || '조축ON'}</h1></div>
        <span className="workspace-access">{activePage === 'service' ? '서비스관리자' : isAdmin ? `${roleLabels[user.role]} · 기록 관리` : '회원 · 기록 조회'}</span>
      </section>}
      {auth.message && <p className="session-message" role="alert">{auth.message}</p>}
      {auth.accessIssue && <section className="access-section access-recheck" role="alert"><h2>접속 상태를 다시 확인해 주세요.</h2><p>{auth.accessIssue}</p><p className="access-note">이전 팀의 입력을 다른 팀으로 옮기거나 자동 저장하지 않습니다. 작성 중인 내용이 있다면 확인 후 화면을 새로 엽니다.</p><button className="primary-button" onClick={() => void recheck()} disabled={rechecking}>{rechecking ? '확인 중…' : '접속 상태 확인'}</button></section>}
      {auth.state.status === 'loading' && <div className="empty-state" role="status">접속 상태를 확인하고 있습니다.</div>}
      {auth.state.status === 'error' && <div className="empty-state" role="alert"><p>접속 상태를 확인하지 못했습니다.</p><button className="secondary-button" onClick={() => void recheck()} disabled={rechecking}>다시 확인</button></div>}
      <div hidden={!!auth.accessIssue && resetToken === null} inert={!!auth.accessIssue && resetToken === null}>
        {auth.state.status !== 'loading' && auth.state.status !== 'error' && (resetToken !== null
          ? <PasswordResetPanel key={resetToken} token={resetToken} onCompleted={passwordChanged} onCancel={() => void navigate('login')} /> : inviteToken
          ? <InvitationPanel key={inviteToken} token={inviteToken} user={user} onLogin={auth.signedIn} onAccepted={next => { setInviteToken(''); signedIn(next); setNotice('운영진 초대를 수락했습니다.') }} onCancel={() => void navigate('home')} onSessionExpired={auth.expired} />
          : <>
            {user && <details className="management-menu" ref={managementMenu} onKeyDown={event => { if (event.key === 'Escape') { closeManagement(); managementMenu.current?.querySelector('summary')?.focus() } }}><summary>팀 · 접속 관리 <span aria-hidden="true">⌄</span></summary><div className="access-navigation" aria-label="접속 및 팀 관리 메뉴">
              {user.authType === 'ACCOUNT' && <button className={`secondary-button${activePage === 'teams' ? ' selected' : ''}`} onClick={() => void navigate('teams')}>내 팀 목록</button>}
              {team && <button className="secondary-button" onClick={() => void navigate('home')}>우리 팀 홈</button>}
              {user.authType === 'ACCOUNT' && <button className={`secondary-button${activePage === 'password' ? ' selected' : ''}`} onClick={() => void navigate('password')}>내 비밀번호 변경</button>}
              {user.serviceAdmin && <button className={`secondary-button${activePage === 'service' ? ' selected' : ''}`} onClick={() => void navigate('service')}>서비스 팀 관리</button>}
              {user.serviceAdmin && <button className={`secondary-button${activePage === 'account-recovery' ? ' selected' : ''}`} onClick={() => void navigate('account-recovery')}>운영진 계정 복구</button>}
              {team && isAdmin && <button className={`secondary-button${activePage === 'code-management' ? ' selected' : ''}`} onClick={() => void navigate('code-management')}>팀 접속 코드 관리</button>}
              {team && isDirector && <button className={`secondary-button${activePage === 'coach-management' ? ' selected' : ''}`} onClick={() => void navigate('coach-management')}>코치 관리</button>}
              <button className="access-text-button" onClick={() => void codeAccess()}>{user.authType === 'ACCOUNT' ? '회원 코드로 접속' : '다른 팀 들어가기'}</button>
            </div></details>}
            {activePage === 'code' && <section id="access" className="directory-section" aria-labelledby="access-title"><h2 id="access-title" className="sr-only">팀 코드로 접속</h2><TeamCodeForm key={identity} switching={user?.authType === 'TEAM_CODE'} onEntered={signedIn} onLogin={() => void navigate('login')} onCancel={user ? () => void navigate('home') : undefined} /></section>}
            {activePage === 'login' && <section id="access" className="directory-section" aria-labelledby="access-title"><h2 id="access-title" className="sr-only">운영진 로그인</h2><LoginForm onLogin={signedIn} /><button className="access-text-button" onClick={() => void codeAccess()}>팀 코드로 접속하기</button></section>}
            {user && activePage === 'service' && user.serviceAdmin && <ServiceTeams key={`service:${identity}`} onSessionExpired={auth.expired} onMembershipChanged={auth.refresh} />}
            {user?.serviceAdmin && activePage === 'account-recovery' && <AccountRecoveryManager key={`recovery:${identity}`} onSessionExpired={auth.expired} />}
            {user?.authType === 'ACCOUNT' && activePage === 'password' && <PasswordChangeForm onChanged={passwordChanged} onSessionExpired={auth.expired} onCancel={() => void navigate('home')} />}
            {user && team && activePage === 'dashboard' && <HomeSection key={`home:${identity}`} isAdmin={isAdmin} onOpenMatch={id => void openHomeMatch(id)} onCreateMatch={() => void openHomeMatch('new')} onOpenStats={() => void showSection(null, 'stats')} onOpenPlayers={() => void showSection(null, 'players')} onSessionExpired={auth.expired} />}
            {user?.authType === 'ACCOUNT' && activePage === 'teams' && <MyTeams key={`teams:${identity}`} user={user} onSelected={signedIn} onSessionExpired={auth.expired} onRefresh={() => void auth.refresh()} />}
            {user && team && isAdmin && activePage === 'code-management' && <TeamCodeManager key={`codes:${identity}`} team={team} onSessionExpired={auth.expired} />}
            {user && team && isDirector && activePage === 'coach-management' && <CoachManager key={`coaches:${identity}`} team={team} onSessionExpired={auth.expired} />}
            {user && team && activePage === 'workspace' && <div key={identity} className="workspace-content">{section === 'players' ? <section className="directory-section" id="players" aria-labelledby="players-title"><SquadSection ref={squad} isAdmin={isAdmin} onSessionExpired={auth.expired} /></section> : section === 'stats' ? <StatsSection onSessionExpired={auth.expired} /> : section === 'tournaments' ? <TournamentSection isAdmin={isAdmin} onSessionExpired={auth.expired} onOpenMatches={id => void openTournamentMatches(id)} /> : section === 'guide' ? <UserGuide audience={isAdmin ? 'staff' : 'member'} /> : <MatchSection key={`matches:${initialTournamentId ?? 'all'}:${launch?.key ?? 0}`} initialOpen={launch?.id} initialTournamentId={initialTournamentId} team={team} isAdmin={isAdmin} recoveryOwner={isAdmin && user.authType === 'ACCOUNT' && user.username ? { username: user.username, teamId: team.id } : null} onSessionExpired={auth.expired} />}</div>}
          </>)}
      </div>
      <div className="app-install-area"><InstallApp /></div>
    </main>
    {switchToCode && !auth.accessIssue && <ConfirmAction title="개인 계정에서 로그아웃할까요?" description="회원 코드는 조회 전용입니다. 로그아웃하면 이 계정의 탭 임시 초안도 삭제됩니다. 다시 수정하려면 운영진 계정으로 로그인해 주세요." confirmLabel="로그아웃하고 코드 입력" onCancel={() => setSwitchToCode(false)} onConfirm={() => void confirmCodeAccess()} />}
    <AccessToast message={notice} clear={() => setNotice('')} />
    <footer className="site-footer"><span>{serviceBrand.name}</span><p>우리의 축구는, 기록으로 이어집니다.</p></footer>
  </div>
}
