import { useEffect, useState, useImperativeHandle } from 'react'
import type { Ref } from 'react'
import { PlayerDirectory } from './PlayerDirectory'
import { PlayerEditor } from './PlayerEditor'
import { BulkPlayerEditor } from './BulkPlayerEditor'
import type { Player, PlayerQuery } from './api'
import { usePlayers } from './usePlayers'
import { PlayerFilters } from './PlayerFilters'
import { hasPlayerFilters } from './query'

export interface SquadNavigation { returnToList: () => boolean }

export function SquadSection({ isAdmin, onSessionExpired, ref }: { isAdmin: boolean; onSessionExpired: () => void; ref?: Ref<SquadNavigation> }) {
  const { state, query, availableAgeGroups, changeQuery, setPage, retry } = usePlayers()
  const [editor, setEditor] = useState<{ player: Player | null } | null>(null)
  const [notice, setNotice] = useState('')
  const [bulkMode, setBulkMode] = useState<'manual' | 'excel' | null>(null)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [optionsExpanded, setOptionsExpanded] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const filtered = hasPlayerFilters(query)
  function resetFilters() { changeQuery({ ageGroup: '', clubRole: '', positionGroup: '' }) }
  function closeEditor() {
    setEditor(null); setBulkMode(null); setNotice(''); setConfirmLeave(false); retry()
    window.location.hash = 'players'
  }
  function returnToList() {
    if (busy) { setNotice('처리 중이에요. 끝나면 선수단으로 돌아갈 수 있어요.'); return false }
    if (editor || bulkMode) { setConfirmLeave(true); return false }
    closeEditor()
    return true
  }
  useImperativeHandle(ref, () => ({ returnToList }))
  useEffect(() => { if (state.status === 'unauthorized') onSessionExpired() }, [state.status, onSessionExpired])
  function saved(player: Player) {
    setNotice(`${player.name} 선수를 ${editor?.player ? '수정' : '등록'}했어요.`)
    if (!editor?.player) setPage(0)
    setEditor(null)
    retry()
  }
  return <>
    <div className="section-heading">
      <div><p className="eyebrow muted">SQUAD</p><h2 id="players-title">선수단</h2></div>
      {state.status === 'success' && <span className="squad-count">{filtered ? '조건에 맞는 선수' : '활동 선수'} <strong>{state.data.totalElements}</strong>명</span>}
    </div>
    <div className="squad-toolbar"><p className="section-description">등번호·포지션·연령대로 우리 팀 선수를 찾아보세요.</p>
    {isAdmin && !editor && !bulkMode && <div className="registration-actions">
      <button className="primary-button" onClick={() => { setNotice(''); setEditor({ player: null }) }}>선수 등록</button>
      <button className="secondary-button" onClick={() => { setNotice(''); setBulkMode('manual') }}>여러 명 입력</button>
      <button className="secondary-button" onClick={() => { setNotice(''); setBulkMode('excel') }}>엑셀 업로드</button>
    </div>}</div>
    {notice && <p className="save-notice" role="status">{notice}</p>}
    {confirmLeave && <div className="dialog-backdrop"><div className="leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-title" aria-describedby="leave-description"
      onKeyDown={event => { if (event.key === 'Escape') setConfirmLeave(false); if (event.key === 'Tab') { event.preventDefault(); const next = event.currentTarget.querySelector<HTMLButtonElement>(document.activeElement?.getAttribute('data-leave') === 'cancel' ? '[data-leave="confirm"]' : '[data-leave="cancel"]'); next?.focus() } }}>
      <h3 id="leave-title">선수단으로 돌아갈까요?</h3><p id="leave-description">저장하지 않은 입력 내용은 사라져요.</p><div className="registration-actions">
        <button autoFocus data-leave="cancel" className="secondary-button" onClick={() => setConfirmLeave(false)}>계속 수정</button>
        <button data-leave="confirm" className="primary-button" onClick={closeEditor}>입력 취소하고 선수단 보기</button>
      </div></div></div>}
    {isAdmin && editor && <PlayerEditor key={editor.player?.id ?? 'new'} player={editor.player} onSaved={saved} onCancel={returnToList} onBusyChange={setBusy} onSessionExpired={onSessionExpired} />}
    {isAdmin && bulkMode && <BulkPlayerEditor initialMode={bulkMode} onSessionExpired={onSessionExpired}
      onCancel={returnToList} onBusyChange={setBusy} onSaved={count => {
        setBulkMode(null); setNotice(`선수 ${count}명을 등록했어요.`)
        setPage(0)
        retry()
      }} />}
    {!editor && !bulkMode && <>
    <PlayerFilters values={query} availableAgeGroups={availableAgeGroups} onChange={changeQuery} onReset={resetFilters} />
    <div className="roster-controls" aria-label="선수 목록 보기 설정">
      <div className="view-switch" role="group" aria-label="목록 보기 방식">
        <button className="secondary-button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>카드 보기</button>
        <button className="secondary-button" aria-pressed={view === 'table'} onClick={() => setView('table')}>표 보기</button>
      </div>
      <button className="secondary-button roster-options-toggle" aria-expanded={optionsExpanded} aria-controls="roster-options" onClick={() => setOptionsExpanded(value => !value)}>정렬·표시 <span aria-hidden="true">{optionsExpanded ? '⌃' : '⌄'}</span></button>
      <div id="roster-options" className={`roster-options${optionsExpanded ? ' is-expanded' : ''}`}>
      <label>페이지당 인원<select value={query.size} onChange={e => changeQuery({ size: Number(e.target.value) })}>
        {[10, 20, 30].map(size => <option key={size} value={size}>{size}명</option>)}</select></label>
      <label>정렬 기준<select value={query.sort} onChange={e => changeQuery({ sort: e.target.value as PlayerQuery['sort'] })}>
        <option value="shirtNumber">등번호순</option><option value="age">나이순</option><option value="name">이름순</option><option value="preferredPosition">선호 포지션순 (1지망)</option></select></label>
      <label>정렬 방향<select value={query.direction} onChange={e => changeQuery({ direction: e.target.value as PlayerQuery['direction'] })}>
        <option value="asc">{query.sort === 'preferredPosition' ? '골키퍼 → 수비 → 미드 → 공격' : query.sort === 'age' ? '어린 순' : query.sort === 'name' ? '가나다순' : '낮은 번호부터'}</option>
        <option value="desc">{query.sort === 'preferredPosition' ? '공격 → 미드 → 수비 → 골키퍼' : query.sort === 'age' ? '나이 많은 순' : query.sort === 'name' ? '가나다 역순' : '높은 번호부터'}</option></select></label>
      </div>
    </div>
    <div aria-live="polite" aria-busy={state.status === 'loading'}>
      {state.status === 'loading' && <div className="empty-state"><span className="loading-dot" /><p role="status">선수단을 불러오는 중이에요.</p></div>}
      {state.status === 'error' && <div className="empty-state error-state" role="alert">
        <span className="empty-number" aria-hidden="true">!</span><h3>선수단을 불러오지 못했어요</h3>
        <p>잠시 후 다시 시도해 주세요.</p><button className="secondary-button" onClick={retry}>다시 불러오기</button>
      </div>}
      {state.status === 'success' && <PlayerDirectory data={state.data} view={view} onPageChange={setPage} filtered={filtered} onResetFilters={resetFilters}
        onEdit={isAdmin && !editor && !bulkMode ? player => { setNotice(''); setEditor({ player }) } : undefined} />}
    </div>
    </>}
  </>
}
