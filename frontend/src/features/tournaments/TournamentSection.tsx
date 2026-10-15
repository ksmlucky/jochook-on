import { useEffect, useState } from 'react'
import { SessionExpiredError } from '../auth/api'
import { AccessToast } from '../teams/AccessUi'
import { fetchTournaments, fetchTournamentYears } from './api'
import { TournamentEditor } from './TournamentEditor'
import { TournamentDetail } from './TournamentDetail'
import { tournamentDateRange } from './types'
import type { Tournament, TournamentPage } from './types'
import { MonthRangeFilter } from '../../app/MonthRangeFilter'
import { YearOptionsStatus } from '../../app/YearOptionsStatus'
import { useAvailableYears } from '../../app/useAvailableYears'
import type { MonthRangeSelection } from '../../app/yearMonth'
import './tournaments.css'

export function TournamentSection({ isAdmin, onSessionExpired, onOpenMatches }: {
  isAdmin: boolean; onSessionExpired: () => void; onOpenMatches: (id: number) => void
}) {
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [period, setPeriod] = useState<MonthRangeSelection>({ startMonth: null, endMonth: null })
  const availableYears = useAvailableYears(fetchTournamentYears, onSessionExpired, revision)
  const [data, setData] = useState<TournamentPage | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [editor, setEditor] = useState<{ tournament: Tournament | null } | null>(null)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError('')
    fetchTournaments(page, controller.signal, 10, undefined, period).then(result => {
      if (controller.signal.aborted) return
      if (page > 0 && page >= result.totalPages) { setPage(Math.max(0, result.totalPages - 1)); return }
      setData(result)
    }).catch(cause => {
      if (controller.signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError('대회 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
    })
    return () => controller.abort()
  }, [page, revision, onSessionExpired, period])
  function closeDetail() {
    const previous = selected; setSelected(null)
    requestAnimationFrame(() => document.getElementById(`tournament-open-${previous}`)?.focus())
  }
  return <section className="directory-section tournament-section" id="tournaments" aria-labelledby={editor && isAdmin ? 'tournament-editor-title' : selected !== null ? 'tournament-detail-title' : 'tournaments-title'}>
    {editor && isAdmin ? <TournamentEditor key={editor.tournament?.id ?? 'new'} tournament={editor.tournament} onSessionExpired={onSessionExpired} onClose={() => { setEditor(null); setRevision(value => value + 1) }} onSaved={saved => {
      setEditor(null); setSelected(saved.id); setRevision(value => value + 1); setNotice(editor.tournament ? '대회 정보를 저장했어요.' : '대회를 등록했어요.')
    }} /> : selected !== null ? <TournamentDetail key={selected} id={selected} revision={revision} isAdmin={isAdmin} onEdit={tournament => setEditor({ tournament })} onClose={closeDetail} onOpenMatches={onOpenMatches} onSessionExpired={onSessionExpired} /> : <>
      <div className="section-heading"><div><p className="eyebrow muted">OUR TOURNAMENTS</p><h2 id="tournaments-title">대회</h2></div>
        {isAdmin && <button type="button" className="primary-button" onClick={() => setEditor({ tournament: null })}>대회 등록</button>}</div>
      <p className="section-description">함께 참가하는 대회의 일정과 경기 기록을 모아요.</p>
      <div className="list-period-filter">
        <MonthRangeFilter value={period} years={availableYears.years}
          onChange={value => { setPeriod(value); setPage(0) }} />
        <p className="field-help">선택한 기간에 하루라도 진행하는 대회를 보여줘요.</p>
        <YearOptionsStatus loading={availableYears.loading} error={availableYears.error} onRetry={availableYears.retry} />
      </div>
      {error ? <div className="save-notice" role="alert"><p>{error}</p><button type="button" className="secondary-button" onClick={() => setRevision(value => value + 1)}>다시 불러오기</button></div>
        : !data ? <p className="save-notice" role="status">대회 목록을 불러오는 중이에요.</p>
          : !data.items.length ? <div className="empty-state"><h3>{period.startMonth !== null ? '선택한 기간에 진행하는 대회가 없어요.' : '아직 등록한 대회가 없어요.'}</h3><p>{period.startMonth !== null ? '기간을 바꿔 다른 대회를 확인해 보세요.' : isAdmin ? '대회 이름과 기간부터 등록해 보세요.' : '운영진이 대회를 등록하면 이곳에서 볼 수 있어요.'}</p></div> : <>
            <ul className="tournament-list">{data.items.map(item => <li key={item.id} className="tournament-card"><p className="tournament-date">{tournamentDateRange(item)}</p><h3>{item.name}</h3>
              <dl><div><dt>장소</dt><dd>{item.venue || '미입력'}</dd></div><div><dt>참가 부문</dt><dd>{item.division || '미입력'}</dd></div><div><dt>연결 경기</dt><dd>{item.matchCount}경기</dd></div></dl>
              <div className="tournament-card-actions"><button type="button" className="secondary-button" id={`tournament-open-${item.id}`} aria-label={`${item.name} 상세 보기`} onClick={() => setSelected(item.id)}>상세 보기</button><button type="button" className="secondary-button" aria-label={`${item.name} 경기 보기`} onClick={() => onOpenMatches(item.id)}>경기 보기</button></div>
            </li>)}</ul>
            {data.totalPages > 1 && <nav className="tournament-pagination" aria-label="대회 목록 페이지"><button type="button" className="secondary-button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>이전 대회</button><span>{page + 1} / {data.totalPages} · {data.totalElements}개</span><button type="button" className="secondary-button" disabled={page + 1 >= data.totalPages} onClick={() => setPage(value => value + 1)}>다음 대회</button></nav>}
          </>}
    </>}
    <AccessToast message={notice} clear={() => setNotice('')} />
  </section>
}
