export type TeamDisplay = Readonly<{ name: string }>

// 현재 단일 팀 운영 환경의 표시 정보다. 팀별 로그인·데이터 분리는 별도 구현한다.
export const currentTeam: TeamDisplay = { name: 'HANA FC' }
