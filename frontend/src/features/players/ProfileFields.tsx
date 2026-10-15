import { seoulYear } from './age'
import { birthYearOptions, validBirthYearInput } from './inputOptions'
import './player-input-controls.css'

const clubRoles = ['정회원', '코치', '감독', '총무', '회장']

export function ClubRoleField({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const selected = value || '정회원'
  return <div><label htmlFor={id}>직책</label><select id={id} value={selected} aria-describedby={`${id}-role-help`} onChange={e => onChange(e.target.value)}>
    {!clubRoles.includes(selected) && <option value={selected} disabled>잘못된 값: {selected}</option>}
    {clubRoles.map(role => <option key={role} value={role}>{role}</option>)}
  </select><p className="field-help" id={`${id}-role-help`}>선수단에 표시할 직책이에요. 이 선택으로 수정 권한이 생기지는 않아요.</p></div>
}

export function BirthYearField({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const currentYear = seoulYear()
  const years = birthYearOptions(currentYear).map(String)
  const valid = validBirthYearInput(value, currentYear)
  const outsideOptions = value !== '' && valid && !years.includes(value)
  return <div><label htmlFor={id}>생년 <span>선택</span></label>
    <div className="player-value-controls">
      <input id={id} type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={value}
        onChange={e => onChange(e.target.value)} placeholder="직접 입력" aria-invalid={!valid} aria-describedby={`${id}-help`} />
      <select aria-label="생년 목록에서 선택" value={valid ? value : '__invalid'} aria-describedby={`${id}-help`} onChange={e => onChange(e.target.value)}>
        <option value="">미확인</option>
        {!valid && <option value="__invalid" disabled>입력값 확인</option>}
        {outsideOptions && <option value={value} disabled>{value}년 · 직접 입력</option>}
        {years.map(year => <option key={year} value={year}>{year}년</option>)}
      </select>
    </div>
    <p id={`${id}-help`} className={valid ? 'field-help' : 'form-error'}>{valid ? `목록은 1950~${currentYear - 17}년이에요. 1900~${currentYear}년은 직접 입력할 수 있어요.` : `1900~${currentYear} 사이의 4자리 연도를 입력해 주세요.`}</p>
  </div>
}
