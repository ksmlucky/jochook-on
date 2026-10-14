// 생일을 수집하지 않으므로 만 나이가 아닌 연도 기준 나이만 계산한다.
export function seoulYear(now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(now))
}

export function yearAge(birthYear: number | null, referenceYear: number): number | null {
  return birthYear !== null && Number.isInteger(birthYear) && Number.isInteger(referenceYear)
    && birthYear >= 1900 && birthYear <= referenceYear ? referenceYear - birthYear : null
}

export function ageBand(birthYear: number | null, referenceYear: number): string {
  const age = yearAge(birthYear, referenceYear)
  return age === null ? '연령대 미확인' : age < 10 ? '10세 미만' : `${Math.floor(age / 10) * 10}대`
}

export function ageDescription(birthYear: number | null, referenceYear: number): string {
  const age = yearAge(birthYear, referenceYear)
  return age === null ? '생년·연령대 미확인' : `${birthYear}년생 · ${ageBand(birthYear, referenceYear)} · 연도 기준 ${age}세`
}
