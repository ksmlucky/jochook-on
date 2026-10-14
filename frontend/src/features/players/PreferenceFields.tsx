import { preferredPositions } from './api'

export function PreferenceFields({ id, values, onChange, unknown = false }: {
  id: string; values: [string, string, string]; onChange: (values: [string, string, string]) => void; unknown?: boolean
}) {
  return <>{values.map((value, index) => <div key={index}>
    <label htmlFor={`${id}-choice-${index}`}>{index + 1}지망 <span>{unknown ? '미확인' : index === 0 ? '필수' : '선택'}</span></label>
    <select id={`${id}-choice-${index}`} value={value} required={index === 0 && !unknown} disabled={unknown || (index > 0 && !values[index - 1])}
      onChange={event => {
        const next: [string, string, string] = [...values]
        next[index] = event.target.value
        if (!next[index]) for (let following = index + 1; following < 3; following++) next[following] = ''
        onChange(next)
      }}>
      <option value="">{index === 0 ? '포지션 선택' : '선택 안 함'}</option>
      {value && !preferredPositions.some(position => position === value) && <option value={value}>잘못된 값: {value}</option>}
      {preferredPositions.map(position => <option key={position} value={position} disabled={values.some((chosen, i) => i !== index && chosen === position)}>{position}</option>)}
    </select>
  </div>)}</>
}
