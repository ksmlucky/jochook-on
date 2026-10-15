import { useEffect, useId, useState } from 'react'
import { monthRangeDraft, monthRangeFromDraft, monthRangeLabel, monthRangeYearOptions } from './yearMonth'
import type { MonthRangeDraft, MonthRangeSelection } from './yearMonth'
import './year-month-filter.css'

const allTime: MonthRangeSelection = { startMonth: null, endMonth: null }
export function MonthRangeFilter({ value, years, onChange, resetValue = allTime, resetLabel = '전체 기간', showAllTime = false, disabled = false }: {
  value: MonthRangeSelection; years: number[]; onChange: (value: MonthRangeSelection) => void
  resetValue?: MonthRangeSelection; resetLabel?: string; showAllTime?: boolean; disabled?: boolean
}) {
  const id = useId()
  const [draft, setDraft] = useState<MonthRangeDraft>(() => monthRangeDraft(value))
  const [error, setError] = useState('')
  useEffect(() => { setDraft(monthRangeDraft(value)); setError('') }, [value.startMonth, value.endMonth])
  const appliedDraft = monthRangeDraft(value)
  const changed = (Object.keys(draft) as (keyof MonthRangeDraft)[]).some(key => draft[key] !== appliedDraft[key])
  const options = monthRangeYearOptions(years, [draft.startYear, draft.endYear, appliedDraft.startYear, appliedDraft.endYear])
  const months = Array.from({ length: 12 }, (_, index) => index + 1)
  function update(key: keyof MonthRangeDraft, next: string) { setDraft(previous => ({ ...previous, [key]: next })); setError('') }
  function apply() {
    try { const next = monthRangeFromDraft(draft); setError(''); onChange(next) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '조회 기간을 다시 확인해 주세요.') }
  }
  function choosePreset(next: MonthRangeSelection) { setDraft(monthRangeDraft(next)); setError(''); onChange({ ...next }) }
  return <div className="month-range-filter" role="group" aria-label="조회 기간" aria-describedby={`${id}-applied${error ? ` ${id}-error` : ''}`}>
    <div className="month-range-fields">
      <div className="month-range-bound">
        <label htmlFor={`${id}-start-year`}>시작 연도<select id={`${id}-start-year`} value={draft.startYear} disabled={disabled} onChange={event => update('startYear', event.target.value)}>
          <option value="">연도 선택</option>{options.map(year => <option key={year} value={year}>{year}년</option>)}
        </select></label>
        <label htmlFor={`${id}-start-month`}>시작 월<select id={`${id}-start-month`} value={draft.startMonthNumber} disabled={disabled} onChange={event => update('startMonthNumber', event.target.value)}>
          <option value="">월 선택</option>{months.map(month => <option key={month} value={month}>{month}월</option>)}
        </select></label>
      </div>
      <span className="month-range-divider" aria-hidden="true">~</span>
      <div className="month-range-bound">
        <label htmlFor={`${id}-end-year`}>종료 연도<select id={`${id}-end-year`} value={draft.endYear} disabled={disabled} onChange={event => update('endYear', event.target.value)}>
          <option value="">연도 선택</option>{options.map(year => <option key={year} value={year}>{year}년</option>)}
        </select></label>
        <label htmlFor={`${id}-end-month`}>종료 월<select id={`${id}-end-month`} value={draft.endMonthNumber} disabled={disabled} onChange={event => update('endMonthNumber', event.target.value)}>
          <option value="">월 선택</option>{months.map(month => <option key={month} value={month}>{month}월</option>)}
        </select></label>
      </div>
    </div>
    {error && <p id={`${id}-error`} className="form-error" role="alert">{error} 기존 조회 결과는 유지돼요.</p>}
    <div className="month-range-actions"><button type="button" className="primary-button" disabled={disabled} onClick={apply}>조회</button>
      <button type="button" className="secondary-button" disabled={disabled} aria-pressed={value.startMonth === resetValue.startMonth && value.endMonth === resetValue.endMonth} onClick={() => choosePreset(resetValue)}>{resetLabel}</button>
      {showAllTime && <button type="button" className="secondary-button" disabled={disabled} aria-pressed={value.startMonth === null && value.endMonth === null} onClick={() => choosePreset(allTime)}>전체 기간</button>}</div>
    <p id={`${id}-applied`} className="field-help month-range-applied">조회 중: <strong>{monthRangeLabel(value)}</strong>{changed && <span> · 기간을 바꿨어요. ‘조회’를 눌러 적용하세요.</span>}</p>
  </div>
}
