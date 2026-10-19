import { useEffect, useId, useState } from 'react'
import { SessionExpiredError } from '../auth/api'
import { fetchAllTournaments } from './api'
import { tournamentDateRange } from './types'
import type { Tournament } from './types'
import './tournaments.css'
import { CreateTournamentDialog } from './CreateTournamentDialog'

export function TournamentPicker({ value, onChange, disabled = false, onSessionExpired, id, label = '대회', emptyLabel = '리그 · 매주 하는 경기', selectedLabel, allowCreate = false }: {
  value: number | null; onChange: (id: number | null, tournament: Tournament | null) => void
  disabled?: boolean; onSessionExpired: () => void; id?: string; label?: string; emptyLabel?: string; selectedLabel?: string; allowCreate?: boolean
}) {
  const generatedId = useId(), controlId = id ?? `tournament-${generatedId}`
  const [items, setItems] = useState<Tournament[] | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [creating, setCreating] = useState(false)
  useEffect(() => {
    const controller = new AbortController(); setItems(null); setError('')
    fetchAllTournaments(controller.signal).then(result => { if (!controller.signal.aborted) setItems(result) }).catch(cause => {
      if (controller.signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError('대회 목록을 불러오지 못했어요.')
    })
    return () => controller.abort()
  }, [revision, onSessionExpired])
  return <div className="tournament-picker"><label htmlFor={controlId}>{label}</label>
    <select id={controlId} value={value ?? ''} disabled={disabled || !items} aria-describedby={error ? `${controlId}-error` : undefined} onChange={event => {
      const nextId = event.target.value ? Number(event.target.value) : null
      onChange(nextId, items?.find(item => item.id === nextId) ?? null)
    }}><option value="">{emptyLabel}</option>
      {value !== null && !items?.some(item => item.id === value) && <option value={value}>{selectedLabel || '선택한 대회 · 목록 확인 필요'}</option>}
      {items?.map(item => <option key={item.id} value={item.id}>{item.name} · {tournamentDateRange(item)}</option>)}
    </select>
    {!items && !error && <small role="status">대회 목록을 불러오는 중이에요.</small>}
    {items?.length === 0 && <small role="status">등록된 대회가 없어요.{allowCreate ? ' 아래에서 대회를 등록하면 선택할 수 있어요.' : ''}</small>}
    {allowCreate && <div className="tournament-picker-actions"><button type="button" className="secondary-button" disabled={disabled} onClick={() => setCreating(true)}>+ 대회 등록</button><button type="button" className="secondary-button" disabled={disabled || !items} onClick={() => setRevision(previous => previous + 1)}>목록 새로고침</button></div>}
    {error && <div id={`${controlId}-error`} className="tournament-picker-error" role="alert"><span>{error}</span><button type="button" className="secondary-button" disabled={disabled} onClick={() => setRevision(value => value + 1)}>다시 불러오기</button></div>}
    {creating && <CreateTournamentDialog onClose={() => setCreating(false)} onSessionExpired={onSessionExpired} onSaved={item => {
      setItems(previous => [...(previous ?? []).filter(row => row.id !== item.id), item]); onChange(item.id, item); setCreating(false); setRevision(previous => previous + 1)
    }} />}
  </div>
}
