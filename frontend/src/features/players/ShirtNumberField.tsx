import { parseShirtNumber, validShirtNumberInput } from './inputOptions'
import './player-input-controls.css'

export function ShirtNumberAvailability({ loading, error, onRefresh, disabled = false, selectOnly = false }: {
  loading: boolean; error: string; onRefresh: () => void; disabled?: boolean; selectOnly?: boolean
}) {
  return <div className="shirt-availability">
    <p role={error ? 'alert' : 'status'}>{loading ? (selectOnly ? '남는 등번호를 확인하고 있어요. 잠시 후 목록에서 선택해 주세요.' : '팀 전체 활동 선수와 용병의 등번호를 확인하고 있어요. 직접 입력은 가능해요.') : error || '현재 팀의 활동 선수·용병과 입력 중인 다른 행의 번호를 제외해요. 저장할 때 중복을 다시 확인해요.'}</p>
    <button type="button" className="secondary-button" disabled={loading || disabled} onClick={onRefresh}>{error ? '등번호 다시 불러오기' : '등번호 새로고침'}</button>
  </div>
}

export function ShirtNumberField({ id, value, onChange, available, error, selectOnly = false }: {
  id: string; value: string; onChange: (value: string) => void; available: readonly number[] | null; error?: string; selectOnly?: boolean
}) {
  const valid = validShirtNumberInput(value), number = parseShirtNumber(value)
  const occupied = available !== null && number !== null && !available.includes(number)
  const message = error || (!valid ? '1~99번을 입력하거나 비워 주세요.' : occupied ? '다른 활동 선수·용병 또는 입력 중인 다른 행에서 쓰는 번호예요.'
    : available === null ? (selectOnly ? '등번호를 불러오는 중이거나 확인이 필요해요. 위의 등번호 확인·입력 안내에서 다시 불러올 수 있어요.' : '목록 확인 전에는 직접 입력해 주세요.') : available.length === 0 ? '현재 선택할 수 있는 번호가 없어요. 번호 없이도 등록할 수 있어요.' : selectOnly ? '남는 번호 중에서 선택해 주세요.' : '직접 입력하거나 남는 번호를 목록에서 골라 주세요.')
  const selected = value.trim() === '' ? '' : valid && number !== null ? String(number) : '__invalid'
  return <div className="shirt-number-field"><label htmlFor={id}>등번호 <span>선택</span></label>
    <div className={selectOnly ? "player-select-control" : "player-value-controls"}>
      {!selectOnly && <input id={id} type="text" inputMode="numeric" maxLength={20} value={value} onChange={event => onChange(event.target.value)} placeholder="직접 입력" aria-invalid={!!error || !valid || occupied} aria-describedby={`${id}-help`} />}
      <select id={selectOnly ? id : undefined} aria-invalid={!!error || !valid || occupied} aria-label="등번호 목록에서 선택" value={selected} disabled={available === null} aria-describedby={`${id}-help`} onChange={event => onChange(event.target.value)}>
        <option value="">미등록</option>
        {!valid && <option value="__invalid" disabled>입력값 확인</option>}
        {number !== null && (available === null || occupied) && <option value={number} disabled>{number}번 · {occupied ? '사용 중' : '확인 중'}</option>}
        {available?.map(item => <option key={item} value={item}>{item}번</option>)}
      </select>
    </div>
    <p id={`${id}-help`} className={error || !valid || occupied ? 'form-error' : 'field-help'}>{message}</p>
  </div>
}
