import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useEditGuard, useLeaveGuard } from '../../app/LeaveGuard'
import { SessionExpiredError } from '../auth/api'
import { ConfirmAction } from '../teams/AccessUi'
import { fetchTournament, saveTournament, TournamentRequestError } from './api'
import { emptyTournament, tournamentDraft, validateTournament } from './types'
import type { Tournament, TournamentDraft } from './types'

export function TournamentEditor({ tournament, onSaved, onClose, onSessionExpired, embedded = false }: {
  tournament: Tournament | null; onSaved: (value: Tournament) => void; onClose: () => void; onSessionExpired: () => void; embedded?: boolean
}) {
  const [baseline, setBaseline] = useState(tournament)
  const [draft, setDraft] = useState<TournamentDraft>(() => tournament ? tournamentDraft(tournament) : emptyTournament())
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [reloadConfirm, setReloadConfirm] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Partial<Record<keyof TournamentDraft, string>>>({})
  const guard = useLeaveGuard()
  const request = useRef<AbortController | null>(null)
  const submitting = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const errorElement = useRef<HTMLParagraphElement>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline ? tournamentDraft(baseline) : emptyTournament())
  useEditGuard(dirty, busy)
  useEffect(() => {
    const controller = new AbortController(); request.current = controller
    heading.current?.focus(); heading.current?.scrollIntoView({ block: 'start' })
    return () => controller.abort()
  }, [])
  useEffect(() => { if (error) errorElement.current?.focus() }, [error])
  function change(field: keyof TournamentDraft, value: string) {
    setDraft(previous => ({ ...previous, [field]: value })); setFields(previous => ({ ...previous, [field]: undefined }))
  }
  async function close() {
    if (busy) return
    if (embedded) { if (!dirty || window.confirm('작성 중인 대회 정보는 저장하지 않고 닫을까요? 경기 초안은 유지돼요.')) onClose(); return }
    if (await guard.confirmLeave()) onClose()
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (embedded) event.stopPropagation()
    if (submitting.current || busy || blocked || !request.current || request.current.signal.aborted) return
    const errors = validateTournament(draft); setFields(errors)
    if (Object.keys(errors).length) { setError('대회 이름과 날짜, 입력한 내용을 확인해 주세요.'); return }
    const controller = request.current
    submitting.current = true; setBusy(true); setError('')
    try {
      const saved = await saveTournament(draft, baseline, controller.signal)
      if (!controller.signal.aborted) onSaved(saved)
    } catch (cause) {
      if (controller.signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') return
      if (cause instanceof SessionExpiredError) { onSessionExpired(); return }
      if (cause instanceof TournamentRequestError && cause.status < 500) {
        setError(cause.message); setFields(cause.fieldErrors)
        if (cause.status === 409 || cause.status === 404) { setBlocked(true); setConflict(cause.status === 409) }
      } else {
        setError('저장 결과를 확인하지 못했어요. 중복 등록을 막기 위해 재전송을 멈췄어요. 입력 내용은 이 화면에 유지했으니 목록에서 저장 여부를 확인해 주세요.'); setBlocked(true)
      }
    } finally { submitting.current = false; if (!controller.signal.aborted) setBusy(false) }
  }
  async function reload() {
    if (!baseline || busy || submitting.current || !request.current) return
    const controller = request.current
    submitting.current = true; setBusy(true); setReloadConfirm(false)
    try {
      const latest = await fetchTournament(baseline.id, controller.signal)
      if (controller.signal.aborted) return
      setBaseline(latest); setDraft(tournamentDraft(latest)); setBlocked(false); setConflict(false); setError(''); setFields({})
    } catch (cause) {
      if (controller.signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError(cause instanceof Error ? cause.message : '최신 대회를 불러오지 못했어요. 현재 입력은 유지했어요.')
    } finally { submitting.current = false; if (!controller.signal.aborted) setBusy(false) }
  }
  return <section className="tournament-editor" aria-labelledby="tournament-editor-title">
    <div className="section-heading"><div><p className="eyebrow muted">TOURNAMENT</p><h3 id="tournament-editor-title" ref={heading} tabIndex={-1}>{baseline ? '대회 정보 수정' : '새 대회 등록'}</h3></div>
      <button type="button" className="secondary-button" data-tournament-close disabled={busy} onClick={() => void close()}>{embedded ? '경기 작성으로' : '대회 목록으로'}</button></div>
    <p className="field-help">대회 이름과 기간을 입력해 주세요. 경기 기록은 대회를 만든 뒤 연결할 수 있어요.</p>
    <p className="field-help">이름 예시: 2026 봄대회 / 2026 가을대회 / 2027 K7. 같은 대회도 참가 연도별로 따로 등록해요.</p>
    <form onSubmit={submit} noValidate aria-busy={busy}>
      <fieldset className="tournament-fields" disabled={busy || blocked}><legend className="sr-only">대회 기본 정보</legend>
        {(['name', 'startDate', 'endDate', 'venue', 'division'] as const).map(field => {
          const labels = { name: '대회 이름', startDate: '시작일', endDate: '종료일', venue: '장소', division: '참가 부문' }
          const required = ['name', 'startDate', 'endDate'].includes(field), date = field === 'startDate' || field === 'endDate'
          return <div key={field} className={field === 'name' ? 'tournament-field-wide' : ''}><label htmlFor={`tournament-${field}`}>{labels[field]} <span>{required ? '필수' : '선택'}</span></label>
            <input id={`tournament-${field}`} type={date ? 'date' : 'text'} value={draft[field]} onChange={event => change(field, event.target.value)} required={required}
              maxLength={date ? undefined : field === 'division' ? 80 : 120} min={date ? field === 'endDate' && draft.startDate ? draft.startDate : '1000-01-01' : undefined} max={date ? '9999-12-31' : undefined}
              aria-invalid={!!fields[field]} aria-describedby={fields[field] ? `tournament-${field}-error` : undefined} />
            {fields[field] && <p className="form-error" id={`tournament-${field}-error`}>{fields[field]}</p>}</div>
        })}
        <div className="tournament-field-wide"><label htmlFor="tournament-notes">메모 <span>선택 · 최대 3,000자</span></label>
          <textarea id="tournament-notes" rows={4} maxLength={3000} value={draft.notes} onChange={event => change('notes', event.target.value)} aria-invalid={!!fields.notes} aria-describedby={fields.notes ? 'tournament-notes-error' : undefined} />
          {fields.notes && <p className="form-error" id="tournament-notes-error">{fields.notes}</p>}</div>
      </fieldset>
      {error && <p ref={errorElement} tabIndex={-1} className="form-error" role="alert">{error}</p>}
      {conflict && <div className="conflict-notice"><p>다른 운영진이 대회 정보를 변경했어요. 작성 중인 내용은 유지했어요. 최신 정보로 교체하려면 아래 버튼을 눌러 주세요.</p><button type="button" className="secondary-button" disabled={busy} onClick={() => setReloadConfirm(true)}>최신 정보 불러오기</button></div>}
      <div className="registration-actions"><button type="submit" className="primary-button" disabled={busy || blocked}>{busy ? '처리 중…' : baseline ? '대회 정보 저장' : '대회 등록'}</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void close()}>{blocked ? '목록에서 저장 여부 확인' : '취소'}</button></div>
    </form>
    {reloadConfirm && <ConfirmAction title="최신 정보로 바꿀까요?" description="현재 작성 중인 내용을 서버의 최신 대회 정보로 교체해요. 취소하면 현재 입력을 유지해요." confirmLabel="최신 정보로 교체" onCancel={() => setReloadConfirm(false)} onConfirm={() => void reload()} />}
  </section>
}
