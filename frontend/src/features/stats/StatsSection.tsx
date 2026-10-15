import { useEffect, useState } from 'react'
import { SessionExpiredError } from '../auth/api'
import { fetchSeasonStats } from './api'
import { koreaYear, selectStats, statsSorts } from './stats'
import type { RecordScope, SeasonStats, StatsFilters, StatsKind, StatsSort } from './stats'
import { HelpDetails } from '../../app/HelpDetails'
import './stats.css'

export function StatsSection({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [filters, setFilters] = useState<StatsFilters>(() => ({ year: koreaYear(), kind: 'EXTERNAL', recordScope: 'COMPLETED', includeGuests: false }))
  const [years, setYears] = useState(() => [koreaYear()])
  const [data, setData] = useState<SeasonStats | null>(null)
  const [sort, setSort] = useState<StatsSort>('goals')
  const [search, setSearch] = useState('')
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError('')
    fetchSeasonStats(filters, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setData(result)
      setYears([...new Set([koreaYear(), filters.year, ...result.availableYears])].sort((a, b) => b - a))
    }).catch(cause => {
      if (controller.signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError('선수 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
    })
    return () => controller.abort()
  }, [filters, revision, onSessionExpired])
  const rows = data ? selectStats(data.items, sort, search) : []
  const goalTotal = data?.items.reduce((total, item) => total + item.goals, 0) ?? 0
  const quarterTotal = data?.items.reduce((total, item) => total + item.creditedQuarters, 0) ?? 0
  const kindLabel = filters.kind === 'EXTERNAL' ? '외부 경기' : filters.kind === 'INTERNAL' ? '자체전' : '전체 경기'
  const scopeLabel = filters.recordScope === 'COMPLETED' ? '기록 완료' : filters.recordScope === 'RECORDED' ? '완료 + 이전 기록' : '작성 중 포함'
  return <section className="directory-section season-stats" id="stats" aria-labelledby="stats-title">
    <div className="section-heading"><div><p className="eyebrow muted">OUR SEASON</p><h2 id="stats-title">선수 기록</h2></div>
      <button className="secondary-button" onClick={() => setRevision(value => value + 1)} disabled={!data && !error}>새로고침</button></div>
    <p className="section-description">한 해의 득점·도움·출전 기록을 확인해 보세요.</p>
    <div className="stats-filters" aria-label="시즌 집계 범위">
      <label>시즌<select value={filters.year} onChange={event => setFilters(value => ({ ...value, year: Number(event.target.value) }))}>{years.map(year => <option key={year} value={year}>{year}년</option>)}</select></label>
      <label>경기 유형<select value={filters.kind} onChange={event => setFilters(value => ({ ...value, kind: event.target.value as StatsKind }))}><option value="EXTERNAL">외부 경기</option><option value="INTERNAL">자체전</option><option value="ALL">전체 경기</option></select></label>
      <label>기록 범위<select value={filters.recordScope} onChange={event => setFilters(value => ({ ...value, recordScope: event.target.value as RecordScope }))}><option value="COMPLETED">기록 완료만</option><option value="RECORDED">완료 + 이전 기록</option><option value="ALL">작성 중 포함</option></select></label>
      <label className="stats-guest-toggle"><input type="checkbox" checked={filters.includeGuests} onChange={event => setFilters(value => ({ ...value, includeGuests: event.target.checked }))} />용병 포함</label>
    </div>
    <p className="stats-scope">{filters.year}년 · {kindLabel} · {scopeLabel} · {filters.includeGuests ? '회원과 용병' : '회원'}<br />오늘까지의 실제 기록을 모았어요. 경기 전 계획은 제외해요.</p>
    {error ? <div className="save-notice" role="alert"><p>{error}</p><button className="secondary-button" onClick={() => setRevision(value => value + 1)}>다시 불러오기</button></div>
      : !data ? <p className="save-notice" role="status">시즌 기록을 불러오는 중이에요.</p> : <>
        <dl className="stats-summary" aria-label="선택한 범위 요약"><div><dt>집계 경기</dt><dd>{data.matchCount}<small>경기</small></dd></div><div><dt>선수 기록 득점</dt><dd>{goalTotal}<small>골</small></dd></div><div><dt>합산 출전</dt><dd>{quarterTotal}<small>쿼터</small></dd></div></dl>
        <p className="stats-count-note">완료 {data.completedMatchCount}경기 · 이전 기록 {data.legacyMatchCount}경기 · 작성 중 {data.inProgressMatchCount}경기
          {data.inProgressMatchCount > 0 && <strong> · 작성 중인 기록의 합계는 바뀔 수 있어요.</strong>}</p>
        {data.matchCount === 0 && <p className="stats-empty-note" role="status"><strong>선택한 조건의 경기가 없어요.</strong><br />예전 경기를 찾는다면 ‘완료 + 이전 기록’을 골라 보세요. 활동 회원의 기록은 0으로 표시돼요.</p>}
        <div className="stats-table-tools"><label>선수 찾기<input type="search" placeholder="이름 또는 등번호" value={search} onChange={event => setSearch(event.target.value)} /></label>
          <label>정렬<select value={sort} onChange={event => setSort(event.target.value as StatsSort)}>{Object.entries(statsSorts).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        <p className="stats-table-hint" id="stats-table-hint">{rows.length}명 · 표를 좌우로 밀면 전체 기록을 볼 수 있어요.</p>
        <div className="stats-table-scroll" tabIndex={0} role="region" aria-label="선수 시즌 기록 표" aria-describedby="stats-table-hint">
          <table className="stats-table"><caption className="sr-only">{filters.year}년 {kindLabel} 선수 기록, {scopeLabel}</caption><thead><tr>
            <th scope="col" className="stats-player-cell">선수</th><th scope="col" aria-sort={sort === 'goals' ? 'descending' : undefined}>득점</th><th scope="col" aria-sort={sort === 'assists' ? 'descending' : undefined}>도움</th>
            <th scope="col" aria-sort={sort === 'appearances' ? 'descending' : undefined}>출전 경기</th><th scope="col" aria-sort={sort === 'creditedQuarters' ? 'descending' : undefined}>출전 쿼터</th><th scope="col" aria-sort={sort === 'attendances' ? 'descending' : undefined}>실제 참석</th>
          </tr></thead><tbody>{rows.map(item => <tr key={item.playerId}><th scope="row" className="stats-player-cell"><span className="stats-player-number">{item.shirtNumber === null ? '—' : `#${item.shirtNumber}`}</span><span className="stats-player-name">{item.name}</span>
            {(item.playerType === 'GUEST' || !item.active) && <small className="stats-player-status">{item.playerType === 'GUEST' ? '용병' : '비활동'}</small>}</th><td className={sort === 'goals' ? 'stats-emphasis' : undefined}>{item.goals}</td><td className={sort === 'assists' ? 'stats-emphasis' : undefined}>{item.assists}</td><td>{item.appearances}</td><td>{item.creditedQuarters}</td><td>{item.attendances}</td></tr>)}</tbody></table>
          {rows.length === 0 && <p className="stats-no-players">{search ? '검색한 선수가 없어요.' : '집계할 선수가 없어요.'}</p>}
        </div>
      </>}
    <HelpDetails title="집계 기준 보기"><ul>
      <li><strong>득점·도움:</strong> 03 실제 출전 기록을 합산해요. 상대 자책골 등이 있어 팀 스코어와 다를 수 있어요.</li>
      <li><strong>출전 경기:</strong> 실제로 뛴 경기 수예요. 자체전에서 A·B팀을 오가도 한 경기로 세요.</li>
      <li><strong>출전 쿼터:</strong> 교체 없이 뛰면 1, 같은 자리에서 교체하면 두 선수에게 각각 0.5를 더해요. 출전 시간으로 환산하지 않아요.</li>
      <li><strong>실제 참석:</strong> 참석·지각으로 기록된 경기 수예요. 출전하지 않아도 포함하며, 참석 예정 투표는 세지 않아요.</li>
      <li><strong>이전 기록:</strong> 완료 표시 기능이 생기기 전에 저장한 경기예요. ‘완료 + 이전 기록’으로 볼 수 있어요.</li>
      <li>한국 시간 오늘까지의 경기만 포함해요. 활동 회원은 기록이 없어도, 비활동 회원은 참석·출전 기록이 있을 때 보여요.</li>
      <li>수정·삭제한 내용은 새로고침하면 반영돼요. 이 기록이 연말 시상 순위를 뜻하지는 않아요.</li>
    </ul></HelpDetails>
  </section>
}
