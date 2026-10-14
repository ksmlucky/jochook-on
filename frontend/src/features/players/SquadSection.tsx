import { useEffect, useState, useImperativeHandle } from 'react'
import type { Ref } from 'react'
import { PlayerDirectory } from './PlayerDirectory'
import { PlayerEditor } from './PlayerEditor'
import { BulkPlayerEditor } from './BulkPlayerEditor'
import type { Player, PlayerQuery } from './api'
import { usePlayers } from './usePlayers'

export interface SquadNavigation { returnToList: () => boolean }

export function SquadSection({ isAdmin, onSessionExpired, ref }: { isAdmin: boolean; onSessionExpired: () => void; ref?: Ref<SquadNavigation> }) {
  const { state, query, changeQuery, setPage, retry } = usePlayers()
  const [editor, setEditor] = useState<{ player: Player | null } | null>(null)
  const [notice, setNotice] = useState('')
  const [bulkMode, setBulkMode] = useState<'manual' | 'excel' | null>(null)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [confirmLeave, setConfirmLeave] = useState(false)
  function closeEditor() {
    setEditor(null); setBulkMode(null); setNotice(''); setConfirmLeave(false); retry()
    window.location.hash = 'players'
  }
  function returnToList() {
    if (busy) { setNotice('요청을 처리하고 있습니다. 완료된 후 선수단으로 돌아가 주세요.'); return false }
    if (editor || bulkMode) { setConfirmLeave(true); return false }
    closeEditor()
    return true
  }
  useImperativeHandle(ref, () => ({ returnToList }))
  useEffect(() => { if (state.status === 'unauthorized') onSessionExpired() }, [state.status, onSessionExpired])
  function saved(player: Player) {
    setNotice(`${player.name} 선수 ${editor?.player ? '수정' : '등록'}을 완료했습니다.`)
    if (!editor?.player) setPage(0)
    setEditor(null)
    retry()
  }
  return <>
    <div className="section-heading">
      <div><p className="eyebrow muted">OUR SQUAD</p><h2 id="players-title">하나의 팀, 우리의 선수들</h2></div>
      {state.status === 'success' && <span className="squad-count">활동 선수 <strong>{state.data.totalElements}</strong>명</span>}
    </div>
    <p className="section-description">선수들의 포지션과 등번호를 한눈에 확인하세요.</p>
    {isAdmin && !editor && !bulkMode && <div className="squad-toolbar"><span>운영진은 선수 정보를 등록하고 수정할 수 있습니다.</span><div className="registration-actions">
      <button className="primary-button" onClick={() => { setNotice(''); setEditor({ player: null }) }}>선수 등록</button>
      <button className="secondary-button" onClick={() => { setNotice(''); setBulkMode('manual') }}>여러 명 입력</button>
      <button className="secondary-button" onClick={() => { setNotice(''); setBulkMode('excel') }}>엑셀 업로드</button>
    </div></div>}
    {notice && <p className="save-notice" role="status">{notice}</p>}
    {confirmLeave && <div className="dialog-backdrop"><div className="leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-title" aria-describedby="leave-description"
      onKeyDown={event => { if (event.key === 'Escape') setConfirmLeave(false); if (event.key === 'Tab') { event.preventDefault(); const next = event.currentTarget.querySelector<HTMLButtonElement>(document.activeElement?.getAttribute('data-leave') === 'cancel' ? '[data-leave="confirm"]' : '[data-leave="cancel"]'); next?.focus() } }}>
      <h3 id="leave-title">선수단 조회로 돌아갈까요?</h3><p id="leave-description">저장하지 않은 입력 내용이 사라집니다.</p><div className="registration-actions">
        <button autoFocus data-leave="cancel" className="secondary-button" onClick={() => setConfirmLeave(false)}>계속 수정</button>
        <button data-leave="confirm" className="primary-button" onClick={closeEditor}>입력 취소하고 선수단 보기</button>
      </div></div></div>}
    {isAdmin && editor && <PlayerEditor key={editor.player?.id ?? 'new'} player={editor.player} onSaved={saved} onCancel={returnToList} onBusyChange={setBusy} onSessionExpired={onSessionExpired} />}
    {isAdmin && bulkMode && <BulkPlayerEditor initialMode={bulkMode} onSessionExpired={onSessionExpired}
      onCancel={returnToList} onBusyChange={setBusy} onSaved={count => {
        setBulkMode(null); setNotice(`${count}명의 선수를 등록했습니다.`)
        setPage(0)
        retry()
      }} />}
    {!editor && !bulkMode && <>
    <div className="roster-controls" aria-label="선수 목록 보기 설정">
      <div className="view-switch" role="group" aria-label="목록 보기 방식">
        <button className="secondary-button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>카드 보기</button>
        <button className="secondary-button" aria-pressed={view === 'table'} onClick={() => setView('table')}>표 보기</button>
      </div>
      <label>페이지당 인원<select value={query.size} onChange={e => changeQuery({ size: Number(e.target.value) })}>
        {[10, 20, 30].map(size => <option key={size} value={size}>{size}명</option>)}</select></label>
      <label>정렬 기준<select value={query.sort} onChange={e => changeQuery({ sort: e.target.value as PlayerQuery['sort'] })}>
        <option value="shirtNumber">등번호순</option><option value="age">나이순</option><option value="name">이름순</option><option value="preferredPosition">선호 포지션순 (1지망)</option></select></label>
      <label>정렬 방향<select value={query.direction} onChange={e => changeQuery({ direction: e.target.value as PlayerQuery['direction'] })}>
        <option value="asc">{query.sort === 'preferredPosition' ? '골키퍼 → 수비 → 미드 → 공격' : query.sort === 'age' ? '어린 순' : query.sort === 'name' ? '가나다순' : '낮은 번호부터'}</option>
        <option value="desc">{query.sort === 'preferredPosition' ? '공격 → 미드 → 수비 → 골키퍼' : query.sort === 'age' ? '나이 많은 순' : query.sort === 'name' ? '가나다 역순' : '높은 번호부터'}</option></select></label>
    </div>
    <div aria-live="polite" aria-busy={state.status === 'loading'}>
      {state.status === 'loading' && <div className="empty-state"><span className="loading-dot" /><p role="status">선수단을 불러오고 있습니다.</p></div>}
      {state.status === 'error' && <div className="empty-state error-state" role="alert">
        <span className="empty-number" aria-hidden="true">!</span><h3>선수단을 불러오지 못했어요</h3>
        <p>잠시 후 다시 시도해 주세요.</p><button className="secondary-button" onClick={retry}>다시 불러오기</button>
      </div>}
      {state.status === 'success' && <PlayerDirectory data={state.data} view={view} onPageChange={setPage}
        onEdit={isAdmin && !editor && !bulkMode ? player => { setNotice(''); setEditor({ player }) } : undefined} />}
    </div>
    </>}
  </>
}
