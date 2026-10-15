import { useEffect, useId, useState } from 'react'
import { SessionExpiredError } from '../auth/api'
import { fetchAllTournaments } from './api'
import { competitionFilterValue, competitionSelection } from './competitionScope'
import type { CompetitionScope, CompetitionSelection } from './competitionScope'
import { tournamentDateRange } from './types'
import type { Tournament } from './types'
import './tournaments.css'

export function CompetitionFilter({ scope = 'ALL', tournamentId = null, tournamentName, onChange, disabled = false, onSessionExpired, allLabel = '전체 경기 · 자체전 포함', id }: {
  scope?: CompetitionScope; tournamentId?: number | null; tournamentName?: string | null
  onChange: (value: CompetitionSelection) => void; disabled?: boolean; onSessionExpired: () => void; allLabel?: string; id?: string
}) {
  const generatedId = useId(), controlId = id ?? `competition-${generatedId}`
  const [items, setItems] = useState<Tournament[] | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController(); setItems(null); setError('')
    fetchAllTournaments(controller.signal).then(result => { if (!controller.signal.aborted) setItems(result) }).catch(cause => {
      if (controller.signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError('대회 목록을 불러오지 못했어요. 전체·리그만·대회만은 계속 선택할 수 있어요.')
    })
    return () => controller.abort()
  }, [revision, onSessionExpired])
  return <div className="tournament-picker competition-filter"><label htmlFor={controlId}>경기 구분</label>
    <select id={controlId} value={competitionFilterValue(scope, tournamentId)} disabled={disabled} aria-describedby={`${controlId}-help${error ? ` ${controlId}-error` : ''}`} onChange={event => {
      const value = event.target.value
      const chosen = items?.find(item => `tournament:${item.id}` === value)
      onChange(competitionSelection(value, chosen?.name ?? (value === `tournament:${tournamentId}` ? tournamentName : null)))
    }}>
      <option value="ALL">{allLabel}</option>
      <option value="LEAGUE">리그만 · 자체전 포함</option>
      <option value="TOURNAMENT">대회만 · 등록한 공식 대회</option>
      <optgroup label="특정 대회">
        {tournamentId != null && !items?.some(item => item.id === tournamentId) && <option value={`tournament:${tournamentId}`}>{tournamentName || '선택한 대회 · 목록 확인 필요'}</option>}
        {items?.map(item => <option key={item.id} value={`tournament:${item.id}`}>{item.name} · {tournamentDateRange(item)}</option>)}
      </optgroup>
    </select>
    <p id={`${controlId}-help`} className="field-help">대회에 연결하지 않은 외부 경기와 자체전은 리그에 포함해요. K7 등 공식 대회는 등록한 대회로 모아요.</p>
    {!items && !error && <small role="status">특정 대회 목록을 불러오는 중이에요. 전체·리그만·대회만은 먼저 선택할 수 있어요.</small>}
    {error && <div id={`${controlId}-error`} className="tournament-picker-error" role="alert"><span>{error}</span><button type="button" className="secondary-button" disabled={disabled} onClick={() => setRevision(value => value + 1)}>대회 목록 다시 불러오기</button></div>}
  </div>
}
