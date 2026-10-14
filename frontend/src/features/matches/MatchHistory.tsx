import { useEffect, useState } from 'react'
import { SessionExpiredError } from '../auth/api'
import { fetchMatchHistory, fetchMatchHistoryDetail } from './api'
import type { MatchHistoryDetail, MatchHistoryPage } from './api'
import { matchHistoryChanges } from './historyChanges'
import { formatHistoryTime } from './historyTime'
import './match-history.css'

const actionLabels = { CREATED: '등록', UPDATED: '수정', DELETED: '삭제' }
export function MatchHistory({ onClose, onSessionExpired }: { onClose: () => void; onSessionExpired: () => void }) {
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState<MatchHistoryPage | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [detail, setDetail] = useState<MatchHistoryDetail | null>(null)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError('')
    fetchMatchHistory(page, controller.signal).then(result => { if (!controller.signal.aborted) setData(result) }).catch(cause => {
      if (controller.signal.aborted) return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError('변경 이력을 불러오지 못했습니다. 다시 시도해 주세요.')
    })
    return () => controller.abort()
  }, [page, revision, onSessionExpired])
  useEffect(() => {
    setDetail(null); setDetailError('')
    if (selected === null) return
    const controller = new AbortController()
    fetchMatchHistoryDetail(selected, controller.signal).then(result => { if (!controller.signal.aborted) setDetail(result) }).catch(cause => {
      if (controller.signal.aborted) return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setDetailError('상세 이력을 불러오지 못했습니다. 목록에서 다시 선택해 주세요.')
    })
    return () => controller.abort()
  }, [selected, onSessionExpired])
  const currentDetail = detail?.id === selected ? detail : null
  const changes = currentDetail ? matchHistoryChanges(currentDetail.before, currentDetail.after) : []
  return <section className="match-history" aria-labelledby="match-history-title">
    <div className="section-heading"><h3 id="match-history-title">경기 기록 변경 이력</h3><button className="secondary-button" onClick={onClose}>경기 목록으로</button></div>
    <p className="field-help">감독·코치만 볼 수 있어요. 기능 적용 이후의 등록·수정·삭제를 기록하며, 이전 변경 내역은 소급해서 만들지 않습니다. 시간은 한국 기준입니다.</p>
    {error ? <div role="alert" className="save-notice"><p>{error}</p><button className="secondary-button" onClick={() => setRevision(value => value + 1)}>다시 불러오기</button></div>
      : !data ? <p role="status">변경 이력을 불러오고 있습니다.</p> : !data.items.length ? <div className="empty-state"><h3>아직 변경 이력이 없어요</h3><p>앞으로 경기 기록을 저장하거나 삭제하면 이곳에 남습니다.</p></div> : <>
        <ul className="match-history-list">{data.items.map(entry => <li key={entry.id}>
          <button className={`match-history-row${selected === entry.id ? ' selected' : ''}`} aria-expanded={selected === entry.id} onClick={() => setSelected(value => value === entry.id ? null : entry.id)}>
            <span className={`history-action ${entry.action.toLowerCase()}`}>{actionLabels[entry.action]}</span>
            <span className="history-match"><strong>{entry.playedOn} · {entry.kind === 'INTERNAL' ? '자체전 A팀 vs B팀' : entry.opponent || '상대 팀 미입력'}</strong><small>작업자 · {entry.actorUsername}</small></span>
            <span className="history-timestamp"><span>변경 일시 · 한국 시간</span><time dateTime={entry.occurredAt}>{formatHistoryTime(entry.occurredAt)}</time></span>
            <span className="history-detail-label">변경 내용 {selected === entry.id ? '닫기' : '보기'}</span>
          </button>
          {selected === entry.id && <div className="history-detail" aria-live="polite">
            {detailError ? <p className="form-error" role="alert">{detailError}</p> : !currentDetail ? <p role="status">변경 내용을 불러오고 있습니다.</p> : <>
              <p className="field-help">{currentDetail.action === 'DELETED' ? '삭제 직전 기록을 보관한 이력입니다. 경기 집계에는 포함되지 않습니다.' : '저장 전후 달라진 항목입니다. 선수 정보는 당시 기록을 기준으로 표시합니다.'}</p>
              {changes.length ? <div className="history-table-scroll" tabIndex={0} role="region" aria-label="경기 변경 전후 비교"><table className="history-table"><thead><tr><th scope="col">항목</th><th scope="col">변경 전</th><th scope="col">변경 후</th></tr></thead>
                <tbody>{changes.map((change, index) => <tr key={index}><th scope="row">{change.label}</th><td>{change.before}</td><td>{change.after}</td></tr>)}</tbody></table></div>
                : <p>저장 당시 경기 내용이 이전과 같습니다.</p>}
            </>}
          </div>}
        </li>)}</ul>
        {data.totalPages > 1 && <div className="pagination"><button className="secondary-button" disabled={page === 0} onClick={() => { setSelected(null); setPage(value => value - 1) }}>이전 이력</button><span>{page + 1} / {data.totalPages} · 총 {data.totalElements}건</span><button className="secondary-button" disabled={page + 1 >= data.totalPages} onClick={() => { setSelected(null); setPage(value => value + 1) }}>다음 이력</button></div>}
      </>}
  </section>
}
