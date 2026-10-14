import { useState } from 'react'
import type { Player } from '../players/api'
import { preferredPositionGroup } from '../players/api'
import { ageBand } from '../players/age'
import type { Participant } from './api'
import { playerLabel } from './api'

export function AttendeePicker({ players, participants, editable, referenceYear, onSelect }: {
  players: Player[]; participants: Participant[]; editable: boolean; referenceYear: number
  onSelect: (player: Player, selected: boolean) => void
}) {
  const [search, setSearch] = useState('')
  const [onlySelected, setOnlySelected] = useState(false)
  const attending = new Set(participants.filter(p => p.vote === 'ATTENDING').map(p => p.playerId))
  const candidates = players.filter(p => (p.playerType !== 'GUEST' || attending.has(p.id)) && (!onlySelected || attending.has(p.id)) && `${p.name} ${p.shirtNumber ?? ''}`.includes(search.trim()))
    .sort((a, b) => (a.shirtNumber ?? 100) - (b.shirtNumber ?? 100) || a.id - b.id)
  return <div className="attendee-picker">
    <div className="attendee-tools"><label>참석 투표 선수 검색<input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름 또는 등번호" /></label>
      <label className="inline-check"><input type="checkbox" checked={onlySelected} onChange={e => setOnlySelected(e.target.checked)} />선택한 선수만 보기</label>
      <strong>참석 예정 {attending.size}명</strong></div>
    <p className="field-help">참석에 투표한 선수를 체크하세요. 체크 해제는 미투표로 돌리며 실제 출석은 바꾸지 않습니다. 불참·미정은 아래 상세 표에서 입력할 수 있습니다.</p>
    <div className="attendee-grid">{candidates.map(p => <label className={`attendee-choice position-${preferredPositionGroup(p.firstChoice)}${attending.has(p.id) ? ' is-selected' : ''}`} key={p.id}>
      <input type="checkbox" checked={attending.has(p.id)} disabled={!editable} onChange={e => onSelect(p, e.target.checked)} aria-label={`${p.name} ${p.shirtNumber === null ? '등번호 없음' : p.shirtNumber + '번'} 참석 예정`} />
      <span><strong>{playerLabel(p)}</strong><small>{[p.firstChoice, p.secondChoice, p.thirdChoice].filter(Boolean).join(' / ') || '포지션 미확인'} · {ageBand(p.birthYear, referenceYear)}</small></span>
    </label>)}</div>
    {!candidates.length && <p className="field-help">조건에 맞는 선수가 없습니다.</p>}
  </div>
}
