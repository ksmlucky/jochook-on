import type { AgeGroup, PlayerFilters as FilterValues } from './query'
import { ageGroupOptions, clubRoleOptions, hasPlayerFilters, positionGroupOptions } from './query'
import { seoulYear } from './age'
import { HelpDetails } from '../../app/HelpDetails'
import './player-filters.css'

export function PlayerFilters({ values, availableAgeGroups, onChange, onReset }: {
  values: FilterValues
  availableAgeGroups: AgeGroup[]
  onChange: (patch: Partial<FilterValues>) => void
  onReset: () => void
}) {
  const active = hasPlayerFilters(values)
  return <section className={`player-filters${active ? ' has-filters' : ''}`} aria-labelledby="player-filters-title">
    <div className="player-filters-heading">
      <h3 id="player-filters-title">선수 필터</h3>
      <button type="button" className="secondary-button" disabled={!active} onClick={onReset}>필터 초기화</button>
    </div>
    <div className="player-filter-fields">
      <label>연령대<select value={values.ageGroup ?? ''} onChange={event => onChange({ ageGroup: event.target.value as FilterValues['ageGroup'] })}>
        <option value="">전체 연령대</option>
        {ageGroupOptions.filter(([value]) => availableAgeGroups.includes(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>직책<select value={values.clubRole ?? ''} onChange={event => onChange({ clubRole: event.target.value as FilterValues['clubRole'] })}>
        <option value="">전체 직책</option>
        {clubRoleOptions.map(role => <option key={role} value={role}>{role}</option>)}
      </select></label>
      <label>포지션<select value={values.positionGroup ?? ''} onChange={event => onChange({ positionGroup: event.target.value as FilterValues['positionGroup'] })}>
        <option value="">전체 포지션</option>
        {positionGroupOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>
    <p className="field-help">선택한 조건에 맞는 활동 선수예요. 포지션은 1지망을 기준으로 해요.</p>
    <HelpDetails title="필터 기준 보기">
      <ul><li>여러 조건을 고르면 모두 만족하는 선수만 보여요.</li>
        <li>연령대는 생일과 관계없이 {seoulYear()}년 − 생년으로 계산해요.</li></ul>
    </HelpDetails>
  </section>
}
