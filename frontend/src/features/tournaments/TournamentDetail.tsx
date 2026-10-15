import { useEffect, useRef, useState } from 'react'
import { SessionExpiredError } from '../auth/api'
import { fetchTournament } from './api'
import { tournamentDateRange } from './types'
import type { Tournament } from './types'

export function TournamentDetail({ id, revision, isAdmin, onEdit, onClose, onOpenMatches, onSessionExpired }: {
  id: number; revision: number; isAdmin: boolean; onEdit: (value: Tournament) => void; onClose: () => void
  onOpenMatches: (id: number) => void; onSessionExpired: () => void
}) {
  const [data, setData] = useState<Tournament | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'start' }) }, [])
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError('')
    fetchTournament(id, controller.signal).then(result => { if (!controller.signal.aborted) setData(result) }).catch(cause => {
      if (controller.signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError(cause instanceof Error ? cause.message : '대회 정보를 불러오지 못했어요.')
    })
    return () => controller.abort()
  }, [id, revision, retry, onSessionExpired])
  return <section className="tournament-detail" aria-labelledby="tournament-detail-title">
    <div className="section-heading"><div><p className="eyebrow muted">TOURNAMENT</p><h2 ref={heading} tabIndex={-1} id="tournament-detail-title">{data?.name ?? '대회 정보'}</h2></div>
      <button type="button" className="secondary-button" onClick={onClose}>대회 목록으로</button></div>
    {error ? <div className="save-notice" role="alert"><p>{error}</p><button type="button" className="secondary-button" onClick={() => setRetry(value => value + 1)}>다시 불러오기</button></div>
      : !data ? <p className="save-notice" role="status">대회 정보를 불러오는 중이에요.</p> : <>
        <dl className="tournament-detail-fields"><div><dt>대회 기간</dt><dd>{tournamentDateRange(data)}</dd></div><div><dt>장소</dt><dd>{data.venue || '미입력'}</dd></div><div><dt>참가 부문</dt><dd>{data.division || '미입력'}</dd></div><div><dt>연결된 경기</dt><dd>{data.matchCount}경기</dd></div><div className="tournament-field-wide"><dt>메모</dt><dd className="tournament-notes">{data.notes || '메모가 없어요.'}</dd></div></dl>
        <div className="registration-actions"><button type="button" className="primary-button" onClick={() => onOpenMatches(data.id)}>대회 경기 보기</button>
          {isAdmin && <button type="button" className="secondary-button" onClick={() => onEdit(data)}>대회 정보 수정</button>}</div>
        <p className="field-help">경기 기록에서 이 대회를 선택하면 연결돼요. 새 대회 경기는 전·후반 각 30분으로 시작하며 기존 경기 형식은 유지돼요.</p>
      </>}
  </section>
}
