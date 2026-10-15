import { useEffect, useRef, useState } from 'react'
import { SessionExpiredError } from '../auth/api'
import { fetchMatch, MatchRequestError } from '../matches/api'
import type { MatchRecord } from '../matches/api'
import { MatchEditor } from '../matches/MatchEditor'

const ignoreSave = () => {}

export function PlayerMatchReader({ matchId, onClose, onSessionExpired }: {
  matchId: number; onClose: () => void; onSessionExpired: () => void
}) {
  const [record, setRecord] = useState<MatchRecord | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'start' }) }, [])
  useEffect(() => {
    const controller = new AbortController()
    setRecord(null); setError('')
    fetchMatch(matchId, controller.signal).then(result => {
      if (!controller.signal.aborted) setRecord(result)
    }).catch(cause => {
      if (controller.signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError(cause instanceof MatchRequestError && cause.status === 404
        ? '원본 경기 기록을 찾지 못했어요. 삭제된 경기일 수 있으니 선수 기록으로 돌아가 새로고침해 주세요.'
        : '원본 경기 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
    })
    return () => controller.abort()
  }, [matchId, revision, onSessionExpired])
  return <section className="player-match-reader" aria-labelledby="player-match-reader-title">
    <div className="section-heading"><div><p className="eyebrow muted">MATCH DETAILS</p><h2 id="player-match-reader-title" ref={heading} tabIndex={-1}>원본 경기 보기</h2></div>
      {!record && <button type="button" className="secondary-button" onClick={onClose}>선수 기록으로</button>}</div>
    <p className="field-help">이곳에서는 조회만 할 수 있어요. 운영진의 기록 수정은 경기 기록 메뉴에서 해 주세요.</p>
    {error ? <div className="save-notice" role="alert"><p>{error}</p><button type="button" className="secondary-button" onClick={() => setRevision(value => value + 1)}>다시 불러오기</button></div>
      : !record ? <p className="save-notice" role="status">경기 기록을 불러오는 중이에요.</p>
        : <MatchEditor key={record.id} record={record} players={[]} isAdmin={false} recoveryOwner={null} closeLabel="선수 기록으로"
          onSaved={ignoreSave} onStepSaved={ignoreSave} onClose={onClose} onSessionExpired={onSessionExpired} />}
  </section>
}
