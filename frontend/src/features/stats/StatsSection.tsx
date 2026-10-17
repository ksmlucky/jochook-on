import { useEffect, useState } from 'react'
import { SessionExpiredError } from '../auth/api'
import { fetchSeasonStats } from './api'
import { concededSummary, defaultStatsFilters, defaultStatsSortDirection, koreaYear, selectStats, statsScopeLabel, statsSorts, statsYearOptions } from './stats'
import type { SeasonStats, StatsFilters, StatsSort, StatsSortDirection } from './stats'
import { HelpDetails } from '../../app/HelpDetails'
import { PlayerSeasonDetail } from './PlayerSeasonDetail'
import { StatsFiltersControl } from './StatsFiltersControl'
import { StatsDisplayControl } from './StatsDisplayControl'
import { StatsCards } from './StatsCards'
import { displayScoringValue, isScoringMetric, scoringMetrics, statsDisplayModes } from './scoringMetrics'
import type { StatsDisplayMode } from './scoringMetrics'
import './stats.css'
import { statsPage } from './pagination'

export function StatsSection({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [filters, setFilters] = useState<StatsFilters>(() => defaultStatsFilters())
  const [years, setYears] = useState(() => [koreaYear()])
  const [data, setData] = useState<SeasonStats | null>(null)
  const [sorting, setSorting] = useState<{ key: StatsSort; direction: StatsSortDirection }>({ key: 'goals', direction: 'desc' })
  const { key: sort, direction } = sorting
  const [displayMode, setDisplayMode] = useState<StatsDisplayMode>('TOTAL')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'cards' | 'table'>(() => window.matchMedia('(max-width: 680px)').matches ? 'cards' : 'table')
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [pageSize, setPageSize] = useState(10)
  const [pagination, setPagination] = useState({ scope: '', page: 0 })
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError('')
    fetchSeasonStats(filters, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setData(result)
      setYears(statsYearOptions(result.availableYears, filters.year))
    }).catch(cause => {
      if (controller.signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError('선수 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
    })
    return () => controller.abort()
  }, [filters, revision, onSessionExpired])
  const rows = data ? selectStats(data.items, sort, search, displayMode, direction) : []
  const pageScope = JSON.stringify([filters, sort, direction, search, displayMode, pageSize])
  useEffect(() => { setPagination({ scope: pageScope, page: 0 }) }, [pageScope])
  const pageData = statsPage(rows, pagination.scope === pageScope ? pagination.page : 0, pageSize)
  function changePage(page: number) {
    setPagination({ scope: pageScope, page })
    requestAnimationFrame(() => {
      const target = document.getElementById('stats-table-hint')
      target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'start' })
    })
  }
  function sortHeader(key: StatsSort, className?: string) {
    const active = sort === key
    const next = active ? direction === 'asc' ? 'desc' : 'asc' : defaultStatsSortDirection(key)
    const label = statsSorts[key]
    return <th key={key} scope="col" className={className} aria-sort={active ? direction === 'asc' ? 'ascending' : 'descending' : undefined}>
      <button type="button" className="stats-sort-button" aria-label={`${label} ${next === 'asc' ? '오름차순' : '내림차순'} 정렬`}
        onClick={() => setSorting({ key, direction: next })}>{label}<span aria-hidden="true">{active ? direction === 'asc' ? '↑' : '↓' : '↕'}</span></button>
    </th>
  }
  const goalTotal = data?.items.reduce((total, item) => total + item.goals, 0) ?? 0
  const conceded = data ? concededSummary(data) : null
  if (selected !== null) return <PlayerSeasonDetail key={selected} playerId={selected} filters={filters} years={years} onFiltersChange={setFilters} displayMode={displayMode} onDisplayModeChange={setDisplayMode} onSessionExpired={onSessionExpired} onClose={() => {
    const targetId = `season-player-${selected}`
    setSelected(null)
    requestAnimationFrame(() => (document.getElementById(targetId) ?? document.getElementById('stats-title'))?.focus())
  }} />
  return <section className="directory-section season-stats" id="stats" aria-labelledby="stats-title">
    <div className="section-heading"><div><p className="eyebrow muted">OUR SEASON</p><h2 id="stats-title" tabIndex={-1}>선수 기록</h2></div>
      <button className="secondary-button" onClick={() => setRevision(value => value + 1)} disabled={!data && !error}>새로고침</button></div>
    <p className="section-description">시작월부터 종료월까지, 원하는 기간의 기록을 모아 보세요.</p>
    <StatsFiltersControl filters={filters} years={years} onChange={setFilters} onSessionExpired={onSessionExpired} />
    <p className="stats-scope">{statsScopeLabel(filters)}<br />오늘까지의 실제 기록을 모았어요. 경기 전 계획은 제외해요.</p>
    {error ? <div className="save-notice" role="alert"><p>{error}</p><button className="secondary-button" onClick={() => setRevision(value => value + 1)}>다시 불러오기</button></div>
      : !data ? <p className="save-notice" role="status">시즌 기록을 불러오는 중이에요.</p> : <>
        <dl className="stats-summary" aria-label="선택한 범위 누적 요약">
          <div><dt>집계 경기</dt><dd>{data.matchCount}<small>경기</small></dd><p className="stats-summary-note">매칭 {data.externalMatchCount ?? '—'}회 · 자체전 {data.internalMatchCount ?? '—'}회</p></div>
          <div><dt>누적 득점</dt><dd>{goalTotal}<small>골</small></dd><p className="stats-summary-note">매칭 + 자체전</p></div>
          <div><dt>누적 실점</dt><dd>{conceded?.value ?? '—'}<small>골</small></dd><p className="stats-summary-note">매칭만 집계</p></div>
        </dl>
        <p className="field-help">{conceded?.note}</p>
        <p className="stats-count-note">완료 {data.completedMatchCount}경기 · 이전 기록 {data.legacyMatchCount}경기 · 작성 중 {data.inProgressMatchCount}경기
          {data.inProgressMatchCount > 0 && <strong> · 작성 중인 기록의 합계는 바뀔 수 있어요.</strong>}</p>
        {data.matchCount === 0 && <p className="stats-empty-note" role="status"><strong>선택한 조건의 경기가 없어요.</strong><br />예전 경기를 찾는다면 ‘완료 + 이전 기록’을 골라 보세요. 활동 회원의 기록은 0으로 표시돼요.</p>}
        <StatsDisplayControl value={displayMode} onChange={setDisplayMode} />
        <div className="stats-table-tools"><label>선수 찾기<input type="search" placeholder="이름 또는 등번호" value={search} onChange={event => setSearch(event.target.value)} /></label>
          {view === 'cards' && <div className="stats-card-sorting"><label>정렬 기준<select value={sort} onChange={event => { const key = event.target.value as StatsSort; setSorting({ key, direction: defaultStatsSortDirection(key) }) }}>{Object.entries(statsSorts).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button type="button" className="secondary-button" aria-label={`정렬 방향 변경: 현재 ${direction === 'asc' ? '오름차순' : '내림차순'}`} onClick={() => setSorting(previous => ({ ...previous, direction: previous.direction === 'asc' ? 'desc' : 'asc' }))}>{direction === 'asc' ? '오름차순 ↑' : '내림차순 ↓'}</button></div>}
          <p className="stats-sort-status" role="status">{statsSorts[sort]} {direction === 'asc' ? '오름차순 ↑' : '내림차순 ↓'}{displayMode !== 'TOTAL' && isScoringMetric(sort) ? ` · ${statsDisplayModes[displayMode]}` : ''}</p></div>
        <div className="stats-view-switch" role="group" aria-label="선수 기록 보기 방식"><button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>간단 보기</button><button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>표 보기</button></div>
        <div className="stats-page-controls"><label>페이지당 인원<select value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>{[10, 20, 30].map(size => <option key={size} value={size}>{size}명</option>)}</select></label></div>
        {sort === 'attendances' && <p className="field-help">출석·지각한 경기마다 1회로 세요. 같은 날 두 경기에 참석하면 2회예요. 출전 여부·참석 예정 투표와는 달라요.</p>}
        <p className="stats-table-hint" id="stats-table-hint" tabIndex={-1}>{pageData.from}–{pageData.to} / {rows.length}명 · {view === 'cards' ? '선수 이름을 누르면 경기별 기록을 볼 수 있어요.' : '열 제목으로 정렬해요. 이름·등번호를 누르면 상세 기록을 볼 수 있어요. 표는 좌우로 밀어 보세요.'}</p>
        {view === 'cards' ? <StatsCards rows={pageData.items} displayMode={displayMode} onSelect={setSelected} /> : <div className="stats-table-scroll" tabIndex={0} role="region" aria-label="선수 시즌 기록 표" aria-describedby="stats-table-hint">
          <table className="stats-table"><caption className="sr-only">{statsScopeLabel(filters)} 선수 기록 · {statsDisplayModes[displayMode]}</caption><thead><tr>
            {sortHeader('shirtNumber', 'stats-number-cell')}{sortHeader('name', 'stats-player-cell')}{scoringMetrics.map(metric => sortHeader(metric))}
            {sortHeader('appearances')}{sortHeader('creditedQuarters')}{sortHeader('attendances')}
          </tr></thead><tbody>{pageData.items.map(item => <tr key={item.playerId}>
            <td className={`stats-number-cell${sort === 'shirtNumber' ? ' stats-emphasis' : ''}`}><button type="button" className="stats-player-link stats-number-link" aria-label={`${item.name} 등번호 ${item.shirtNumber ?? '없음'} 상세 보기`} onClick={() => setSelected(item.playerId)}>{item.shirtNumber === null ? '—' : `#${item.shirtNumber}`}</button></td>
            <th scope="row" className={`stats-player-cell${sort === 'name' ? ' stats-emphasis' : ''}`}><button type="button" id={`season-player-${item.playerId}`} className="stats-player-link" aria-label={`${item.shirtNumber === null ? '등번호 없음' : `${item.shirtNumber}번`} ${item.name} 시즌 상세 기록`} onClick={() => setSelected(item.playerId)}><span className="stats-player-name">{item.name}</span>
            {(item.playerType === 'GUEST' || !item.active) && <small className="stats-player-status">{item.playerType === 'GUEST' ? '용병' : '비활동'}</small>}</button></th>{scoringMetrics.map(metric => <td key={metric} className={sort === metric ? 'stats-emphasis' : undefined}>{displayScoringValue(item, metric, displayMode)}</td>)}<td className={sort === 'appearances' ? 'stats-emphasis' : undefined}>{item.appearances}</td><td className={sort === 'creditedQuarters' ? 'stats-emphasis' : undefined}>{item.creditedQuarters}</td><td className={sort === 'attendances' ? 'stats-emphasis' : undefined}>{item.attendances}</td></tr>)}</tbody></table>
        </div>}
        {pageData.totalPages > 1 && <nav className="pagination" aria-label="선수 기록 페이지">
          <button className="secondary-button" disabled={pageData.page === 0} onClick={() => changePage(pageData.page - 1)}>이전</button>
          <span aria-live="polite">{pageData.page + 1} / {pageData.totalPages}</span>
          <button className="secondary-button" disabled={pageData.page + 1 >= pageData.totalPages} onClick={() => changePage(pageData.page + 1)}>다음</button>
        </nav>}
        {rows.length === 0 && <p className="stats-no-players" role="status">{search ? '검색한 선수가 없어요.' : '집계할 선수가 없어요.'}</p>}
      </>}
    <HelpDetails title="집계 기준 보기"><ul>
      <li><strong>득점·도움:</strong> 03 실제 출전 기록을 합산해요. 상대 자책골 등이 있어 팀 스코어와 다를 수 있어요.</li>
      <li><strong>FK·PK:</strong> 프리킥·페널티킥으로 넣은 골이며 총득점에 이미 포함돼요. 따로 기록하지 않은 이전 경기의 FK·PK는 0으로 보여요.</li>
      <li><strong>1~4쿼터당:</strong> 선택한 범위의 기록을 실제 출전 쿼터로 나눈 뒤 선택한 쿼터 수를 곱해요. 대회의 전·후반도 각각 1쿼터이며 시간 환산은 하지 않아요. 교체 0.5쿼터를 포함하며, 출전 0쿼터는 —로 표시해요. 소수 둘째 자리로 표시하되 정렬은 반올림 전 값으로 해요. 개인 상세 아래의 경기별 기록은 항상 그 경기의 실제 득점·도움이에요.</li>
      <li><strong>출전 경기:</strong> 실제로 뛴 경기 수예요. 자체전에서 A·B팀을 오가도 한 경기로 세요.</li>
      <li><strong>출전 쿼터:</strong> 교체 없이 뛰면 1, 같은 자리에서 교체하면 두 선수에게 각각 0.5를 더해요. 출전 시간으로 환산하지 않아요.</li>
      <li><strong>출석:</strong> 참석·지각으로 기록된 경기마다 1회로 세요. 같은 날 두 경기면 2회예요. 출전하지 않아도 포함하며, 참석 예정 투표는 세지 않아요. ‘출석 (회)’ 제목을 눌러 이 횟수로 정렬해요.</li>
      <li><strong>이전 기록:</strong> 완료 표시 기능이 생기기 전에 저장한 경기예요. ‘완료 + 이전 기록’으로 볼 수 있어요.</li>
      <li>한국 시간 오늘까지의 경기만 포함해요. 활동 회원은 기록이 없어도, 비활동 회원은 참석·출전 기록이 있을 때 보여요.</li>
      <li>수정·삭제한 내용은 새로고침하면 반영돼요. 이 기록이 연말 시상 순위를 뜻하지는 않아요.</li>
    </ul></HelpDetails>
  </section>
}
