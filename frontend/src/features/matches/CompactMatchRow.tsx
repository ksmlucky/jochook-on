import type { MatchSummary } from './api'
import { RecordingStatus } from './RecordingStatus'
import { MatchCategoryBadge } from './MatchCategoryBadge'
import { TeamBadge } from '../teams/TeamLogoManager'
import './match-report.css'

export function CompactMatchRow({ match, teamId, teamName, disabled, onOpen }: {
  match: MatchSummary; teamId: number; teamName: string; disabled?: boolean; onOpen: () => void
}) {
  const internal = match.kind === 'INTERNAL'
  return <button type="button" className="compact-match-row" disabled={disabled} onClick={onOpen}
    aria-label={`${match.playedOn} ${internal ? 'A팀 대 B팀' : `${teamName} 대 ${match.opponent || '상대 팀'}`} ${match.scoreFor ?? '미입력'} 대 ${match.scoreAgainst ?? '미입력'} 경기 보기`}>
    <span className="compact-match-meta"><time dateTime={match.playedOn}>{match.playedOn}</time><MatchCategoryBadge match={match} /><RecordingStatus stage={match.recordingStage} compact /></span>
    <span className="compact-match-versus"><span className="compact-match-team"><span>{internal ? 'A팀' : teamName}</span><TeamBadge teamId={teamId} teamName={internal ? 'A팀' : teamName} /></span>
      <strong className="compact-match-result">{match.scoreFor ?? '—'} : {match.scoreAgainst ?? '—'}</strong>
      <span className="compact-match-team away"><span className="report-opponent-badge" aria-hidden="true">{internal ? 'B' : (match.opponent || '?').slice(0, 1)}</span><span>{internal ? 'B팀' : match.opponent || '상대 팀 미입력'}</span></span>
    </span>
  </button>
}
