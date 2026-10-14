import { SquadSection } from './features/players/SquadSection'
import type { SquadNavigation } from './features/players/SquadSection'
import { useRef } from 'react'
import type { MouseEvent } from 'react'
import { LoginForm } from './features/auth/LoginForm'
import { useAuth } from './features/auth/useAuth'
import { MatchSection } from './features/matches/MatchSection'
import { serviceBrand } from './app/brand'
import { currentTeam } from './app/team'

export function App() {
  const auth = useAuth()
  const squad = useRef<SquadNavigation>(null)
  function showSquad(event: MouseEvent<HTMLAnchorElement>) {
    if (squad.current && !squad.current.returnToList()) event.preventDefault()
  }

  return <div className="app-shell">
    <a className="skip-link" href="#players" onClick={showSquad}>선수단으로 바로가기</a>
    <header className="site-header">
      <a className="club-brand" href="/" aria-label={`${serviceBrand.name} 홈`}>
        <span className="club-crest" aria-hidden="true">{serviceBrand.crest.initial}<span>{serviceBrand.crest.suffix}</span></span>
        <span>{serviceBrand.name}<small>{serviceBrand.englishName}</small></span>
      </a>
      <nav aria-label="주요 메뉴"><a className="active-nav" href="#players" onClick={showSquad}>선수단</a><a className="active-nav" href="#matches">경기 기록</a></nav>
      {auth.state.status === 'authenticated' ? <div className="account-menu">
        <span><strong>{auth.state.user.username}</strong><small>{auth.state.user.role === 'ADMIN' ? '운영진' : '회원'}</small></span>
        <button className="secondary-button" onClick={auth.signOut} disabled={auth.isLoggingOut}>{auth.isLoggingOut ? '로그아웃 중…' : '로그아웃'}</button>
      </div> : <span className="header-note">함께 뛰고, 함께 기록하다</span>}
    </header>

    <main>
      <section className="club-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">{auth.state.status === 'authenticated' ? `현재 팀 · ${currentTeam.name}` : '함께 뛰는 조기축구'}</p>
          <h1 id="hero-title">우리 팀의 기록,<br /><span>함께 쌓아가는 시즌.</span></h1>
          <p className="hero-description">매주 함께 뛰는 우리.<br className="mobile-break" /> 그 순간들을 하나씩 모읍니다.</p>
          <a className="hero-link" href="#players" onClick={showSquad}>{auth.state.status === 'authenticated' ? '선수단 보기' : '로그인하고 선수단 보기'} <span aria-hidden="true">↗</span></a>
        </div>
        <div className="pitch-art" aria-hidden="true"><div className="pitch-outline"><i /><b /><em /></div><span>ONE TEAM.<br />OUR STORY.</span></div>
      </section>

      <section className="directory-section" id="players" aria-labelledby="players-title">
        {auth.message && <p className="session-message" role="alert">{auth.message}</p>}
        {auth.state.status !== 'authenticated' && <h2 id="players-title">{serviceBrand.name} 로그인</h2>}
        {auth.state.status === 'loading' && <div className="empty-state" role="status">로그인 상태를 확인하고 있습니다.</div>}
        {auth.state.status === 'error' && <div className="empty-state" role="alert"><p>서버에 연결하지 못했습니다.</p><button className="secondary-button" onClick={auth.retry}>다시 시도</button></div>}
        {auth.state.status === 'anonymous' && <LoginForm onLogin={auth.signedIn} />}
        {auth.state.status === 'authenticated' && <SquadSection ref={squad} isAdmin={auth.state.user.role === 'ADMIN'} onSessionExpired={auth.expired} />}
      </section>
      {auth.state.status === 'authenticated' && <MatchSection team={currentTeam} isAdmin={auth.state.user.role === 'ADMIN'} onSessionExpired={auth.expired} />}
    </main>
    <footer className="site-footer"><span>{serviceBrand.name}</span><p>우리의 축구는, 기록으로 이어집니다.</p></footer>
  </div>
}
