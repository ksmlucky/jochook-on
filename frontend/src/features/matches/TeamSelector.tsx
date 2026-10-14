import type { MatchTeam } from './api'

export function TeamSelector({ team, onChange, disabled, counts, label }: {
  team: MatchTeam; onChange: (team: MatchTeam) => void; disabled: boolean; counts: Record<MatchTeam, number>; label: string
}) {
  return <div className="match-team-selector" role="group" aria-label={label}>{(['A', 'B'] as const).map(value =>
    <button key={value} type="button" className={`match-team-${value.toLowerCase()}`} aria-pressed={team === value} disabled={disabled} onClick={() => onChange(value)}>
      <strong>{value}팀</strong><span>현재 쿼터 {counts[value]}명 배치</span>
    </button>)}
  </div>
}
