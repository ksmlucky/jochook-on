import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SessionExpiredError } from '../auth/api'
import type { Player } from '../players/api'
import { fetchMatch, fetchMatches, fetchMatchPlayers, playerLabel } from './api'
import { matchTimeRange } from './time'
import type { MatchPage, MatchRecord } from './api'
import { MatchEditor } from './MatchEditor'

export function MatchSection({ isAdmin, onSessionExpired }: { isAdmin: boolean; onSessionExpired: () => void }) {
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState<MatchPage | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)
  const noticeId = useRef(0)
  const [editor, setEditor] = useState<{ record: MatchRecord | null; players: Player[] } | null>(null)
  const opening = useRef(false)
  function notifySaved(message: string) { setNotice({ id: ++noticeId.current, message }) }
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError('')
    fetchMatches(page, controller.signal).then(setData).catch(cause => {
      if (controller.signal.aborted) return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError('경기 목록을 불러오지 못했습니다. 다시 시도해 주세요.')
    })
    return () => controller.abort()
  }, [page, revision, onSessionExpired])
  async function open(id?: number) {
    if (opening.current) return
    opening.current = true; setBusy(true); setError(''); setNotice(null)
    try {
      const [record, players] = await Promise.all([id ? fetchMatch(id) : Promise.resolve(null), isAdmin ? fetchMatchPlayers(new AbortController().signal) : Promise.resolve([])])
      setEditor({ record, players })
    } catch (cause) {
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError('경기 또는 선수 정보를 불러오지 못했습니다. 다시 시도해 주세요.')
    } finally { opening.current = false; setBusy(false) }
  }
  return <section className="directory-section" id="matches" aria-labelledby="matches-title">
    <div className="section-heading"><div><p className="eyebrow muted">MATCH DIARY</p><h2 id="matches-title">매주의 경기, 하나의 기록</h2></div>
      {!editor && isAdmin && <button className="primary-button" disabled={busy} onClick={() => void open()}>경기 기록 등록</button>}
    </div>
    <p className="section-description">참불 투표부터 실제 출석, 4쿼터 출전 명단과 경기 후 이야기까지.</p>
    {notice && createPortal(<div key={notice.id} className="match-save-toast" role="status" aria-live="polite" aria-atomic="true">
      <span className="match-save-toast-icon" aria-hidden="true">✓</span><span>{notice.message}</span>
    </div>, document.body)}
    {error && <div className="save-notice" role="alert"><p>{error}</p><button className="secondary-button" onClick={() => setRevision(r => r + 1)}>목록 다시 불러오기</button></div>}
    {busy && <p className="save-notice" role="status">경기 입력 화면을 준비하고 있습니다.</p>}
    {editor ? <MatchEditor key={editor.record?.id ?? 'new'} record={editor.record} players={editor.players} isAdmin={isAdmin}
      onSessionExpired={onSessionExpired} onClose={() => { setEditor(null); setRevision(r => r + 1) }} onStepSaved={notifySaved}
      onSaved={saved => { setEditor(null); setPage(0); setRevision(r => r + 1); notifySaved(`${saved.playedOn} 경기 기록을 저장했습니다.`) }} /> : <>
      {!data && !error && <p className="save-notice" role="status">경기 목록을 불러오고 있습니다.</p>}
      {data?.items.length === 0 && <div className="empty-state"><span className="empty-number" aria-hidden="true">4Q</span><h3>첫 경기의 기록을 남겨 보세요</h3><p>투표 결과만 먼저 저장하고, 경기 후 출석과 기록을 이어서 입력할 수 있습니다.</p></div>}
      {!!data?.items.length && <ul className="match-list">{data.items.map(m => <li key={m.id}>
        <button className="match-card" disabled={busy} onClick={() => void open(m.id)}>
          <span className="match-date">{m.playedOn}<small>{matchTimeRange(m.kickoff)}</small></span>
          <span className="match-card-details"><strong>{m.kind === 'INTERNAL' ? <>자체전 · A팀 <span className="muted-vs">vs</span> B팀</> : <>HANA FC <span className="muted-vs">vs</span> {m.opponent || '상대 팀 미입력'}</>}</strong><small>{m.venue || '장소 미입력'} · 4-1-2-3 · 4쿼터</small>
            <span className="match-scorers">{m.scorers.length ? <>득점 · {m.scorers.map(p => `${playerLabel(p)} ${m.kind === 'INTERNAL' ? [p.goalsA > 0 ? `A팀 ${p.goalsA}골` : '', p.goalsB > 0 ? `B팀 ${p.goalsB}골` : ''].filter(Boolean).join(' / ') : `${p.goals}골`}`).join(' · ')}{m.scorerCount > 3 && ` · 외 ${m.scorerCount - 3}명`}</> : '등록된 득점자 없음'}</span>
          </span>
          <span className={`match-score${m.scoreFor === null ? ' unrecorded' : ''}`} aria-label={m.scoreFor === null ? '스코어 미입력' : `${m.kind === 'INTERNAL' ? 'A팀' : '우리 팀'} ${m.scoreFor} 대 ${m.kind === 'INTERNAL' ? 'B팀' : '상대 팀'} ${m.scoreAgainst}`}>
            {m.scoreFor === null ? '스코어 미입력' : `${m.scoreFor} : ${m.scoreAgainst}`}<small>{m.kind === 'INTERNAL' ? 'A팀 : B팀' : '우리 팀 : 상대 팀'}</small>
          </span>
          <span className="match-open">기록 보기 ↗</span>
        </button>
      </li>)}</ul>}
      {data && data.totalPages > 1 && <div className="pagination"><button className="secondary-button" disabled={page === 0 || busy} onClick={() => setPage(p => p - 1)}>이전 경기 목록</button>
        <span>{page + 1} / {data.totalPages} · 총 {data.totalElements}경기 · 10개씩</span><button className="secondary-button" disabled={page + 1 >= data.totalPages || busy} onClick={() => setPage(p => p + 1)}>다음 경기 목록</button></div>}
    </>}
  </section>
}
