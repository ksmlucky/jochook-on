import { seoulYear } from './age'

const clubRoles = ['정회원', '코치', '감독', '총무', '회장']

export function ClubRoleField({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const selected = value || '정회원'
  return <div><label htmlFor={id}>직책</label><select id={id} value={selected} onChange={e => onChange(e.target.value)}>
    {!clubRoles.includes(selected) && <option value={selected} disabled>잘못된 값: {selected}</option>}
    {clubRoles.map(role => <option key={role} value={role}>{role}</option>)}
  </select></div>
}

export function BirthYearField({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const currentYear = seoulYear()
  const years = Array.from({ length: currentYear - 1899 }, (_, i) => String(currentYear - i))
  const valid = value === '' || years.includes(value)
  return <div><label htmlFor={id}>생년 <span>선택</span></label>
    <div className="birth-year-controls">
      <input id={id} type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={value}
        onChange={e => onChange(e.target.value)} placeholder="4자리 직접 입력" aria-invalid={!valid} aria-describedby={`${id}-help`} />
      <select aria-label="생년 목록에서 선택" value={valid ? value : '__invalid'} onChange={e => onChange(e.target.value)}>
        <option value="">미확인</option>
        {!valid && <option value="__invalid" disabled>입력값 확인</option>}
        {years.map(year => <option key={year} value={year}>{year}년</option>)}
      </select>
    </div>
    <p id={`${id}-help`} className={valid ? 'field-help' : 'form-error'}>{valid ? '직접 입력하거나 목록에서 선택하세요.' : `1900~${currentYear} 사이의 4자리 연도를 입력해 주세요.`}</p>
  </div>
}
