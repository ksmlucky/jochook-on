import type { SeasonStats } from './stats'
import { displayScoringValue, statsDisplayModes } from './scoringMetrics'
import type { StatsDisplayMode } from './scoringMetrics'

export function StatsCards({ rows, displayMode, onSelect }: {
  rows: SeasonStats['items']; displayMode: StatsDisplayMode; onSelect: (playerId: number) => void
}) {
  return <ul className="stats-card-list" aria-label="선수 기록 간단 보기">{rows.map(item => <li key={item.playerId}>
    <button type="button" id={`season-player-${item.playerId}`} className="stats-card-player" onClick={() => onSelect(item.playerId)}
      aria-label={`${item.shirtNumber === null ? '등번호 없음' : `${item.shirtNumber}번`} ${item.name} 시즌 상세 기록`}>
      <span><small>{item.shirtNumber === null ? '등번호 없음' : `#${item.shirtNumber}`}</small> <strong>{item.name}</strong>
        {(item.playerType === 'GUEST' || !item.active) && <small> · {item.playerType === 'GUEST' ? '용병' : '비활동'}</small>}</span>
      <span aria-hidden="true">상세 ›</span>
    </button>
    <dl className="stats-card-values">
      <div><dt>득점</dt><dd>{displayScoringValue(item, 'goals', displayMode)}</dd></div>
      <div><dt>도움</dt><dd>{displayScoringValue(item, 'assists', displayMode)}</dd></div>
      <div><dt>출전 쿼터</dt><dd>{item.creditedQuarters}</dd></div>
      <div><dt>출석 (회)</dt><dd>{item.attendances}</dd></div>
    </dl>
    <p className="stats-card-note">득점·도움 {statsDisplayModes[displayMode]} · 출전 {item.appearances}경기
      {(item.freeKickGoals ?? 0) > 0 && <> · FK {displayScoringValue(item, 'freeKickGoals', displayMode)}</>}
      {(item.penaltyGoals ?? 0) > 0 && <> · PK {displayScoringValue(item, 'penaltyGoals', displayMode)}</>}
    </p>
  </li>)}</ul>
}
