import { CompactMatchRow } from '../matches/CompactMatchRow'
import { useEffect, useState } from 'react'
import { SessionExpiredError } from '../auth/api'
import { fetchMatches } from '../matches/api'
import type { MatchPage } from '../matches/api'
import { RecordingStatus } from '../matches/RecordingStatus'
import { selectHomeMatches } from './homeMatches'
import './home.css'

interface HomeSectionProps {
  teamId: number
  teamName: string
  isAdmin: boolean
  onOpenMatch: (id: number, edit?: boolean) => void
  onCreateMatch: () => void
  onOpenStats: () => void
  onOpenPlayers: () => void
  onSessionExpired: () => void
}

export function HomeSection({ teamId, teamName, isAdmin, onOpenMatch, onCreateMatch, onOpenStats, onOpenPlayers, onSessionExpired }: HomeSectionProps) {
  const [data, setData] = useState<MatchPage | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError('')
    fetchMatches(0, controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result)
    }).catch(cause => {
      if (controller.signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError('최근 경기를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
    })
    return () => controller.abort()
  }, [revision, onSessionExpired])
  const { recent, unfinished } = selectHomeMatches(data?.items ?? [])

  return <section className="team-home" aria-labelledby="team-home-heading">
    <header className="team-home-heading">
      <div><h2 id="team-home-heading" tabIndex={-1}>우리 팀 홈</h2><p>{isAdmin ? '최근 경기를 확인하고, 저장한 기록을 이어서 작성하세요.' : '우리 팀 경기와 선수 기록을 한곳에서 확인하세요.'}</p></div>
      {isAdmin && <button type="button" className="primary-button" onClick={onCreateMatch}>새 경기 기록</button>}
    </header>
    <div className="team-home-shortcuts" aria-label="바로가기">
      <button type="button" onClick={onOpenStats}><strong>선수 기록</strong><span>득점·도움·출전 확인 <span aria-hidden="true">→</span></span></button>
      <button type="button" onClick={onOpenPlayers}><strong>선수단</strong><span>우리 팀 명단 확인 <span aria-hidden="true">→</span></span></button>
    </div>
    {error ? <div className="team-home-message" role="alert"><p>{error}</p><button type="button" className="secondary-button" onClick={() => setRevision(value => value + 1)}>다시 시도</button></div>
      : data === null ? <p className="team-home-message" role="status">최근 경기를 불러오는 중이에요.</p>
        : <>
          {isAdmin && <section className="team-home-resume" aria-labelledby="home-resume-heading">
            <div className="team-home-section-heading"><h3 id="home-resume-heading">이어서 작성</h3><span>저장된 기록</span></div>
            <p className="team-home-caption">최근 10경기에서 작성 중인 기록을 최대 2개 보여줘요. 저장 전 초안은 경기 기록 화면에서 복원하세요.</p>
            {unfinished.length ? <ul className="team-home-resume-list">{unfinished.map(match => <li key={match.id}>
              <div><time dateTime={match.playedOn}>{match.playedOn}</time><strong>{match.kind === 'INTERNAL' ? 'A팀 · B팀 자체전' : match.opponent || '상대 팀 미입력'}</strong><RecordingStatus stage={match.recordingStage} /></div>
              <button type="button" className="secondary-button" onClick={() => onOpenMatch(match.id, true)} aria-label={`${match.playedOn} ${match.kind === 'INTERNAL' ? '자체전' : match.opponent || '경기'} 이어서 작성`}>이어서 작성</button>
            </li>)}</ul> : <p className="team-home-empty">최근 10경기에 작성 중인 기록이 없어요.</p>}
          </section>}
          <section aria-labelledby="home-recent-heading">
            <div className="team-home-section-heading"><h3 id="home-recent-heading">최근 경기</h3><button type="button" className="secondary-button" onClick={() => setRevision(value => value + 1)}>새로고침</button></div>
            {recent.length ? <><p className="team-home-caption">경기 날짜가 최근인 순서로 최대 3개를 보여줘요.</p><ul className="team-home-match-list">{recent.map(match => <li key={`${match.id}-${match.version}`}><CompactMatchRow teamId={teamId} teamName={teamName} match={match} onOpen={() => onOpenMatch(match.id)} /></li>)}</ul></>
              : <p className="team-home-empty">{isAdmin ? '아직 등록한 경기가 없어요. 새 경기 기록으로 시작해 보세요.' : '아직 등록된 경기가 없어요. 운영진이 기록을 등록하면 여기에 보여요.'}</p>}
          </section>
        </>}
  </section>
}
