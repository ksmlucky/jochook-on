import { writeFileSync } from 'node:fs'

// Local proposal only. Contains no real team, account, or access-code data.
const panels = [
  ['선수단', '휴대폰 한 줄에 2명', '이름 · 등번호 · 1지망 · 연령대', '상세 정보 → 생년 · 지망 · 가입일'],
  ['선수 등록', '여러 명 입력 → 직접 입력', '엑셀 업로드 → 파일 선택', '입력 검토 → 전체 등록'],
  ['선수 기록', '전체 조건 검색 · 정렬', '10 / 20 / 30명씩 페이지', '상세 보기 → 같은 페이지 복귀'],
]
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="430" viewBox="0 0 1120 430" role="img" aria-labelledby="title desc">
<title id="title">조축ON 선수 목록 사용성 개선</title><desc id="desc">로컬 개발안. 선수단 모바일 두 열, 수동과 엑셀 진입 분리, 선수 기록 페이지. 운영 배포 전.</desc>
<rect width="1120" height="430" fill="#f5f7f2"/><g font-family="Malgun Gothic, sans-serif" fill="#183d34">
<text x="35" y="52" font-size="26" font-weight="700">조축ON · 선수 목록을 더 짧고 편하게</text>
<text x="35" y="86" font-size="16">2026-10-17 로컬 개발 · 운영 미배포 · 기존 데이터와 집계 정책 유지</text>
${panels.map((panel, i) => `<g transform="translate(${35 + i * 360},115)"><rect width="330" height="220" rx="18" fill="white" stroke="#cbd9cf"/><text x="22" y="42" font-size="21" font-weight="700">${panel[0]}</text>${panel.slice(1).map((text,j)=>`<text x="22" y="${88+j*43}" font-size="15">${text}</text>`).join('')}</g>`).join('')}
<text x="35" y="385" font-size="16">팀 접속 코드: 발급 직후 한 번만 표시 → 별도 보관 · 분실 시 재발급(기존 회원 접속 종료)</text>
</g></svg>`
writeFileSync(new URL('../docs/diagrams/roster-pagination.svg', import.meta.url), svg)
