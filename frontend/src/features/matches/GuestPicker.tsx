import { useRef, useState } from 'react'
import { createGuest, PlayerRequestError, preferredPositions } from '../players/api'
import type { Player, PreferredPosition } from '../players/api'
import { SessionExpiredError } from '../auth/api'
import { playerLabel } from './api'

export function GuestPicker({ players, selectedIds, disabled, onBusy, onAdd, onSessionExpired }: {
  players: Player[]; selectedIds: number[]; disabled: boolean; onBusy: (busy: boolean) => void
  onAdd: (player: Player) => void; onSessionExpired: () => void
}) {
  const [open, setOpen] = useState(false)
  const [existing, setExisting] = useState('')
  const [name, setName] = useState('')
  const [shirt, setShirt] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [choices, setChoices] = useState<(PreferredPosition | '')[]>(['', '', ''])
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState(false)
  const submitting = useRef(false)
  const guests = players.filter(p => p.playerType === 'GUEST' && !selectedIds.includes(p.id))
  async function register() {
    if (disabled || submitting.current || blocked) return
    if (!name.trim()) { setError('용병 이름을 입력해 주세요.'); return }
    if (shirt && (!/^\d{1,2}$/.test(shirt) || Number(shirt) < 1)) { setError('등번호는 1~99 또는 빈칸으로 입력해 주세요.'); return }
    if (birthYear && !/^\d{4}$/.test(birthYear)) { setError('생년은 4자리 또는 빈칸으로 입력해 주세요.'); return }
    if ((choices[1] && !choices[0]) || (choices[2] && !choices[1]) || new Set(choices.filter(Boolean)).size !== choices.filter(Boolean).length) {
      setError('선호 포지션은 순서대로, 서로 다르게 선택해 주세요.'); return
    }
    submitting.current = true; onBusy(true); setError('')
    try {
      const guest = await createGuest({ name: name.trim(), shirtNumber: shirt ? Number(shirt) : null, birthYear: birthYear ? Number(birthYear) : null,
        firstChoice: choices[0] || null, secondChoice: choices[1] || null, thirdChoice: choices[2] || null })
      onAdd(guest); setOpen(false); setName(''); setShirt(''); setBirthYear(''); setChoices(['', '', ''])
    } catch (cause) {
      if (cause instanceof SessionExpiredError) { onSessionExpired(); return }
      if (cause instanceof PlayerRequestError && cause.status < 500) setError([cause.message, ...Object.values(cause.fieldErrors)].join(' '))
      else { setBlocked(true); setError('등록 결과를 확인하지 못했습니다. 중복 등록을 막기 위해 재등록을 멈췄습니다. 경기 입력을 저장한 뒤 다시 열어 기존 용병 목록을 확인해 주세요.') }
    } finally { submitting.current = false; onBusy(false) }
  }
  return <div className="guest-picker">
    <button type="button" className="secondary-button" disabled={disabled} onClick={() => setOpen(v => !v)}>{open ? '용병 추가 접기' : '+ 용병 추가'}</button>
    {open && <div className="guest-fields">
      <p>용병도 실제 참가자로 기록합니다. 추가하면 이 경기의 참석 예정 명단에 들어가며, 정회원 선수단에는 표시하지 않습니다.</p>
      <div className="import-tools"><label>기존 용병 선택<select value={existing} disabled={disabled} onChange={e => setExisting(e.target.value)}><option value="">용병 선택</option>{guests.map(p => <option key={p.id} value={p.id}>{playerLabel(p)} · {[p.firstChoice, p.secondChoice, p.thirdChoice].filter(Boolean).join('/') || '포지션 미확인'}</option>)}</select></label>
        <button type="button" className="secondary-button" disabled={disabled || !existing} onClick={() => { const p = guests.find(p => p.id === Number(existing)); if (p) { onAdd(p); setExisting(''); setOpen(false) } }}>선택한 용병을 명단에 추가</button></div>
      <fieldset className="player-fields" disabled={disabled || blocked} onKeyDown={event => {
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
          event.preventDefault(); void register()
        }
      }}><legend>새 용병 등록</legend>
        <div><label htmlFor="guest-name">용병 이름 <span>필수</span></label><input id="guest-name" maxLength={60} value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label htmlFor="guest-shirt">용병 등번호 <span>선택 · 1~99</span></label><input id="guest-shirt" inputMode="numeric" maxLength={2} value={shirt} onChange={e => setShirt(e.target.value)} placeholder="없으면 빈칸" /></div>
        <div><label htmlFor="guest-birth">용병 생년 <span>선택</span></label><input id="guest-birth" inputMode="numeric" maxLength={4} value={birthYear} onChange={e => setBirthYear(e.target.value)} placeholder="예: 1996" /></div>
        {choices.map((choice, i) => <div key={i}><label htmlFor={`guest-choice-${i}`}>용병 {i + 1}지망 <span>{i === 0 ? '모르면 미확인' : '선택'}</span></label><select id={`guest-choice-${i}`} value={choice} onChange={e => setChoices(previous => previous.map((p, j) => i === j ? e.target.value as PreferredPosition | '' : p))}><option value="">{i === 0 ? '포지션 미확인' : '선택 안 함'}</option>{preferredPositions.map(p => <option key={p} value={p}>{p}</option>)}</select></div>)}
      </fieldset>
      {name.trim() && players.some(p => p.name === name.trim()) && <p className="import-warning">같은 이름의 선수가 있습니다. 동일인이라면 기존 용병 목록에서 선택해 주세요. 동명이인은 새로 등록할 수 있습니다.</p>}
      <p className="field-help">새 프로필은 등록 즉시 DB에 저장되어 다음 경기에도 선택할 수 있습니다. 경기 참가·배치는 계획 저장 시 반영됩니다. 선호 미확인은 자동 편성에서 제외됩니다.</p>
      <button type="button" className="primary-button" disabled={disabled || blocked} onClick={() => void register()}>새 용병 등록 · 명단에 추가</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>}
  </div>
}
