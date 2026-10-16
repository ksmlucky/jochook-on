import { useEffect, useState } from 'react'
import { CompetitionFilter } from '../tournaments/CompetitionFilter'
import { MonthRangeFilter } from '../../app/MonthRangeFilter'
import { koreaYear, statsMonthRange, withStatsCompetition, withStatsKind, withStatsRange } from './stats'
import type { RecordScope, StatsFilters, StatsKind } from './stats'

const kindLabels = { ALL: '전체 유형 · 자체전 포함', EXTERNAL: '외부 경기만', INTERNAL: '자체전만' } as const
const recordLabels = { COMPLETED: '기록 완료만', RECORDED: '완료 + 이전 기록', ALL: '작성 중 포함' } as const

export function StatsFiltersControl({ filters, years, onChange, onSessionExpired }: {
  filters: StatsFilters; years: number[]; onChange: (filters: StatsFilters) => void; onSessionExpired: () => void
}) {
  const [extraOpen, setExtraOpen] = useState(false)
  const [competitionError, setCompetitionError] = useState(false)
  useEffect(() => { if (competitionError) setExtraOpen(true) }, [competitionError])
  return <div className="stats-filter-controls" role="group" aria-label="시즌 집계 범위">
    <div className="stats-primary-filters">
      <MonthRangeFilter value={statsMonthRange(filters)} years={years} showAllTime
        resetValue={{ startMonth: `${koreaYear()}-01`, endMonth: `${koreaYear()}-12` }} resetLabel="올해"
        onChange={range => onChange(withStatsRange(filters, range))} />
    </div>
    <details className="stats-extra-filters" open={extraOpen} onToggle={event => setExtraOpen(event.currentTarget.open)}><summary>경기 조건 <span>{filters.tournamentId != null ? filters.tournamentName || '선택한 대회' : filters.competitionScope === 'LEAGUE' ? '리그만' : filters.competitionScope === 'TOURNAMENT' ? '대회만' : '리그 + 대회'} · {kindLabels[filters.kind]} · {recordLabels[filters.recordScope]} · {filters.includeGuests ? '용병 포함' : '회원만'}{competitionError ? ' · 대회 목록 확인 필요' : ''}</span></summary>
      <CompetitionFilter scope={filters.competitionScope} tournamentId={filters.tournamentId} tournamentName={filters.tournamentName}
        onChange={selection => onChange(withStatsCompetition(filters, selection))} onSessionExpired={onSessionExpired}
        allLabel="전체 · 리그 + 대회" onLoadError={setCompetitionError} />
      <div className="stats-filters">
        <label>경기 유형<select value={filters.kind} onChange={event => onChange(withStatsKind(filters, event.target.value as StatsKind))}>
          {Object.entries(kindLabels).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
        </select></label>
        <label>기록 범위<select value={filters.recordScope} onChange={event => onChange({ ...filters, recordScope: event.target.value as RecordScope })}>
          {Object.entries(recordLabels).map(([scope, label]) => <option key={scope} value={scope}>{label}</option>)}
        </select></label>
        <label className="stats-guest-toggle"><input type="checkbox" checked={filters.includeGuests} onChange={event => onChange({ ...filters, includeGuests: event.target.checked })} />용병 포함</label>
      </div>
      <p className="field-help">외부 경기만·자체전만을 고르면 경기 구분과 함께 적용해요. 대회를 고르면 자체전만 조건은 해제돼요.</p>
    </details>
  </div>
}
