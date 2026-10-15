import { useEffect, useRef, useState } from 'react'
import { SessionExpiredError } from '../auth/api'
import { attendanceLabels } from '../matches/api'
import type { Attendance } from '../matches/api'
import { RecordingStatus } from '../matches/RecordingStatus'
import { MatchCategoryBadge } from '../matches/MatchCategoryBadge'
import { matchTimeRange } from '../matches/time'
import { matchFormatLabel } from '../matches/matchFormat'
import { fetchPlayerSeasonMatches, StatsRequestError } from './api'
import { playerMatchTournamentLabel, statsScopeLabel } from './stats'
import type { PlayerSeasonMatches, StatsFilters } from './stats'
import { PlayerMatchReader } from './PlayerMatchReader'
import { StatsDisplayControl } from './StatsDisplayControl'
import { StatsFiltersControl } from './StatsFiltersControl'
import { displayScoringValue, scoringLabels, scoringMetrics, statsDisplayModes } from './scoringMetrics'
import type { StatsDisplayMode } from './scoringMetrics'
import './player-season-detail.css'

export function PlayerSeasonDetail({ playerId, filters, years, onFiltersChange, displayMode, onDisplayModeChange, onClose, onSessionExpired }: {
  years: number[]; onFiltersChange: (filters: StatsFilters) => void
  playerId: number; filters: StatsFilters; onClose: () => void; onSessionExpired: () => void
  displayMode: StatsDisplayMode; onDisplayModeChange: (mode: StatsDisplayMode) => void
}) {
  const [page, setPage] = useState(0)
  const [data, setData] = useState<PlayerSeasonMatches | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [matchId, setMatchId] = useState<number | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const listHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'start' }) }, [])
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError('')
    fetchPlayerSeasonMatches(playerId, filters, page, controller.signal).then(result => {
      if (controller.signal.aborted) return
      const lastPage = Math.max(0, result.totalPages - 1)
      if (page > lastPage) { setPage(lastPage); return }
      setData(result)
    }).catch(cause => {
      if (controller.signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError(cause instanceof StatsRequestError ? cause.message : '선수의 경기별 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
    })
    return () => controller.abort()
  }, [playerId, filters, page, revision, onSessionExpired])
  function changePage(next: number) {
    setPage(next)
    listHeading.current?.focus(); listHeading.current?.scrollIntoView({ block: 'start' })
  }
  if (matchId !== null) return <PlayerMatchReader key={matchId} matchId={matchId} onSessionExpired={onSessionExpired} onClose={() => {
    const targetId = `player-season-match-${matchId}`
    setMatchId(null)
    requestAnimationFrame(() => document.getElementById(targetId)?.focus())
  }} />
  const player = data?.player
  return <section className="player-season-detail" aria-labelledby="player-season-title">
    <div className="section-heading"><div><p className="eyebrow muted">PLAYER SEASON</p><h2 id="player-season-title" ref={heading} tabIndex={-1}>{player ? player.name : '선수 시즌 기록'}</h2>
      {player && <p className="player-season-identity">{player.shirtNumber === null ? '등번호 없음' : `#${player.shirtNumber}`} · {player.playerType === 'GUEST' ? '용병' : player.active ? '활동 회원' : '비활동 회원'}</p>}</div>
      <button type="button" className="secondary-button" onClick={onClose}>시즌 목록으로</button></div>
    <StatsFiltersControl filters={filters} years={years} onChange={next => {
      setPage(0); setData(null); setError(''); onFiltersChange(next)
    }} onSessionExpired={onSessionExpired} />
    <p className="stats-scope">{statsScopeLabel(filters)}<br />여기서 바꾼 조회 조건은 시즌 목록으로 돌아가도 유지돼요.</p>
    <StatsDisplayControl value={displayMode} onChange={onDisplayModeChange} />
    {error ? <div className="save-notice" role="alert"><p>{error}</p><button type="button" className="secondary-button" onClick={() => setRevision(value => value + 1)}>다시 불러오기</button></div>
      : !data || !player ? <p className="save-notice" role="status">선수의 경기별 기록을 불러오는 중이에요.</p> : <>
        <dl className="player-season-summary player-season-score-summary" aria-label={`선수 시즌 ${statsDisplayModes[displayMode]} 득점과 도움`}>
          {scoringMetrics.map(metric => <div key={metric}><dt>{scoringLabels[metric]}</dt><dd>{displayScoringValue(player, metric, displayMode)}<small>{statsDisplayModes[displayMode]}</small></dd></div>)}
        </dl>
        <dl className="player-season-summary" aria-label="선수 시즌 누적 출전과 출석">
          <div><dt>출전 경기</dt><dd>{player.appearances}<small>경기</small></dd></div><div><dt>출전 쿼터</dt><dd>{player.creditedQuarters}<small>쿼터</small></dd></div>
          <div><dt>출석</dt><dd>{player.attendances}<small>회</small></dd></div>
        </dl>
        <p className="field-help">선택한 조회 조건 전체의 기록이에요. 출석은 경기마다 1회로, 같은 날 두 경기면 2회로 세요. 아래에서 경기별 기록을 확인하세요.</p>
      </>}
    <div className="player-season-list-heading"><h3 ref={listHeading} tabIndex={-1}>경기별 기록{data ? ` · ${data.totalElements}경기` : ''}</h3>
      <button type="button" className="secondary-button" disabled={!data && !error} onClick={() => setRevision(value => value + 1)}>새로고침</button></div>
    {data && !error && <>
      {data.items.length === 0 ? <p className="stats-empty-note" role="status">선택한 조건의 경기별 기록이 없어요. 위에서 시즌이나 경기 구분을 바꿔 보세요.</p>
        : <ul className="player-season-matches">{data.items.map(match => <li key={match.matchId} className="player-season-match">
          <div className="player-season-match-top"><time dateTime={match.playedOn}>{match.playedOn}</time><RecordingStatus stage={match.recordingStage} /></div>
          <MatchCategoryBadge match={match} />
          <h4>{match.kind === 'INTERNAL' ? 'A팀 vs B팀' : match.opponent || '상대 팀 미입력'}</h4>
          {match.tournamentId != null && <p className="player-season-match-tournament">{playerMatchTournamentLabel(match)}</p>}
          <p className="player-season-match-meta">{matchTimeRange(match.kickoff, match.matchFormat)} · {match.venue || '장소 미입력'}</p>
          <p className="player-season-match-meta">{matchFormatLabel(match.matchFormat)}</p>
          <p className="player-season-score"><span>{match.kind === 'INTERNAL' ? 'A팀 : B팀' : '우리 팀 : 상대 팀'}</span><strong>{match.scoreFor === null || match.scoreAgainst === null ? '스코어 미입력' : `${match.scoreFor} : ${match.scoreAgainst}`}</strong></p>
          <dl className="player-season-match-stats" aria-label="이 경기 실제 득점·도움">
            <div><dt>득점</dt><dd>{match.goals}<small>골</small></dd></div>
            <div><dt>도움</dt><dd>{match.assists}<small>도움</small></dd></div>
          </dl>
          {((match.freeKickGoals ?? 0) > 0 || (match.penaltyGoals ?? 0) > 0) && <p className="player-season-match-goal-types">
            {(match.freeKickGoals ?? 0) > 0 && <span>프리킥 {match.freeKickGoals}골</span>}
            {(match.penaltyGoals ?? 0) > 0 && <span>페널티킥 {match.penaltyGoals}골</span>}
          </p>}
          <p className="player-season-match-quarters">실제 출전 <strong>{match.creditedQuarters}쿼터</strong></p>
          <div className="player-season-match-bottom"><p>{match.appeared ? '출전' : '미출전'} · {match.attendance === null ? '출석 미기록' : attendanceLabels[match.attendance as Attendance] ?? '출석 미기록'}</p>
            <button type="button" id={`player-season-match-${match.matchId}`} className="secondary-button" aria-label={`${match.playedOn} ${match.kind === 'INTERNAL' ? '자체전' : match.opponent || '외부 경기'} 원본 경기 보기`} onClick={() => setMatchId(match.matchId)}>원본 경기 보기</button></div>
        </li>)}</ul>}
      {data.totalPages > 1 && <nav className="player-season-pagination" aria-label="선수 경기 기록 페이지"><button type="button" className="secondary-button" disabled={page === 0} onClick={() => changePage(page - 1)}>이전 경기</button><span aria-live="polite">{page + 1} / {data.totalPages}</span><button type="button" className="secondary-button" disabled={page + 1 >= data.totalPages} onClick={() => changePage(page + 1)}>다음 경기</button></nav>}
    </>}
  </section>
}
