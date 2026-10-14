export const ageGroupOptions = [
  ['UNDER_20', '20세 미만'], ['20', '20대'], ['30', '30대'], ['40', '40대'],
  ['50', '50대'], ['60', '60대'], ['70', '70대'], ['80', '80대'], ['90', '90대'],
  ['100_PLUS', '100세 이상'], ['UNKNOWN', '생년 미확인'],
] as const
export type AgeGroup = typeof ageGroupOptions[number][0]
export const positionGroupOptions = [['FW', '공격'], ['MF', '미드'], ['DF', '수비'], ['GK', '키퍼']] as const

export const clubRoleOptions = ['정회원', '코치', '감독', '총무', '회장'] as const

export interface PlayerFilters {
  ageGroup?: AgeGroup | ''
  clubRole?: typeof clubRoleOptions[number] | ''
  positionGroup?: typeof positionGroupOptions[number][0] | ''
}

export interface PlayerQuery extends PlayerFilters {
  size: number
  sort: 'shirtNumber' | 'age' | 'name' | 'id' | 'preferredPosition'
  direction: 'asc' | 'desc'
}

export function hasPlayerFilters(filters: PlayerFilters): boolean {
  return Boolean(filters.ageGroup || filters.clubRole || filters.positionGroup)
}

export function playerQueryParams(page: number, query: PlayerQuery): URLSearchParams {
  const params = new URLSearchParams({ page: String(page), size: String(query.size), sort: query.sort, direction: query.direction })
  if (query.ageGroup) params.set('ageGroup', query.ageGroup)
  if (query.clubRole) params.set('clubRole', query.clubRole)
  if (query.positionGroup) params.set('positionGroup', query.positionGroup)
  return params
}
