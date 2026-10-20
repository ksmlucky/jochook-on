import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Repository-native diagram. Re-run after changing measurements or release state.
// Measurements describe layout on one synthetic fixture, not user task completion time.
const review = {
  date: '2026-10-20',
  state: '운영 반영 f0f9552 · 2026-10-20',
  width: 390,
  before: 1390.30,
  after: 837.20,
  touchBefore: '36 / 32',
  touchAfter: '44',
  contrastBefore: '4.32',
  contrastAfter: '4.93',
}
const reduction = (100 * (review.before - review.after) / review.before).toFixed(1)
const directory = fileURLToPath(new URL('../docs/diagrams/', import.meta.url))
const stem = 'ui-ux-review-2026-10-20'
const esc = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[character]))
const text = (x, y, value, size = 18, fill = '#263d34', weight = 400) => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}">${esc(value)}</text>`
const rect = (x, y, width, height, fill = '#fff', radius = 16) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}"/>`
const lines = (x, y, values, size = 17, fill = '#526457', height = 28) => values.map((value, index) => text(x, y + index * height, value, size, fill)).join('')
let body = rect(0, 0, 1200, 1110, '#f1f5ef', 0)
body += text(48, 58, '조축ON · 한눈에 보는 UX 점검', 32, '#263d34', 800)
body += text(48, 94, `${review.date}  |  ${review.state}`, 17, '#526457')
body += text(48, 137, '기능을 더 늘리기 전에, 결과까지 가는 화면을 짧고 분명하게.', 23, '#245d47', 700)

body += rect(48, 164, 1104, 268)
body += text(72, 201, '같은 가상 데이터 · 390px 화면에서 측정', 19, '#263d34', 700)
body += text(72, 235, '선수 기록의 첫 표 행까지', 17, '#526457')
body += rect(72, 252, 656, 38, '#dce5db', 6)
body += text(88, 278, `개선 전  ${review.before.toFixed(2)}px`, 17, '#263d34', 700)
body += rect(72, 300, 656 * review.after / review.before, 38, '#28634e', 6)
body += text(88, 326, `개선 후  ${review.after.toFixed(2)}px`, 17, '#fff', 700)
body += text(72, 373, `${reduction}% 감소`, 29, '#245d47', 800)
body += text(267, 371, '첫 결과 위에 쌓인 공간을 약 40% 줄임', 17, '#526457')
body += text(72, 405, '조회 시간이나 사용성 점수가 40% 개선됐다는 의미는 아닙니다.', 15, '#526457')
body += `<path d="M772 221V399" stroke="#d7e1d4" stroke-width="2"/>`
body += text(802, 242, '주요 조작 영역', 16, '#526457')
body += text(802, 279, `${review.touchBefore}px → ${review.touchAfter}px`, 25, '#245d47', 800)
body += text(802, 328, 'soft 배경 위 텍스트 대비', 16, '#526457')
body += text(802, 365, `${review.contrastBefore} : 1 → ${review.contrastAfter} : 1`, 25, '#245d47', 800)

body += text(48, 480, '유지할 강점', 23, '#263d34', 800)
const strengths = [
  ['조회와 편집 분리', '결과를 먼저 보고', '수정은 별도 행동으로'],
  ['초안 보호', '실패·이탈 상황에서', '입력한 내용과 상태 구분'],
  ['역할별 가이드', '운영진·회원에 맞는 안내', '앱과 PDF의 공통 원고'],
]
strengths.forEach((item, index) => {
  const x = 48 + index * 376
  body += rect(x, 500, 352, 132, '#e3eedf')
  body += text(x + 22, 535, item[0], 20, '#245d47', 700)
  body += lines(x + 22, 566, item.slice(1))
})

body += text(48, 681, '이번 개선', 23, '#263d34', 800)
const changes = [
  ['01', '상단 통합', '팀 홈을 명시하고', '중복 안내를 줄임'],
  ['02', '통계 설정 접기', '검색·결과를 앞에', '미입력 경고는 유지'],
  ['03', '터치·대비', '조작은 44px 확보', '본문을 더 선명하게'],
  ['04', '로고 이탈 보호', '선택 후 이동 확인', '저장 중 이동 차단'],
]
changes.forEach((item, index) => {
  const x = 48 + index * 282
  body += rect(x, 701, 258, 158)
  body += text(x + 20, 731, item[0], 14, '#526457', 700)
  body += text(x + 20, 763, item[1], 21, '#263d34', 800)
  body += lines(x + 20, 799, item.slice(2), 16, '#526457', 26)
  if (index < 3) body += text(x + 262, 789, '→', 18, '#526457', 700)
})
body += rect(48, 889, 1104, 133, '#263d34')
body += text(72, 928, '다음에 확인할 것', 22, '#fff', 800)
body += text(72, 969, '조회 조건 유지', 19, '#fff', 600)
body += text(368, 969, '목록 페이지 이동의 일관성', 19, '#fff', 600)
body += text(797, 969, '실제 경기장 사용 관찰', 19, '#fff', 600)
body += text(72, 1001, '기능·정책을 임의로 추가하지 않고, 실제 불편과 재현 결과를 바탕으로 순서를 정합니다.', 15, '#dce8dc')
body += text(48, 1063, '운영 배포·공개 URL 검증 완료 · 실제 팀·회원 정보 없음', 16, '#526457')

const description = `모바일 ${review.width}px의 같은 가상 데이터에서 선수 기록 첫 행 위치가 ${review.before.toFixed(2)}px에서 ${review.after.toFixed(2)}px로 ${reduction}% 감소했다. 일부 주요 조작 영역은 36/32px에서 44px, soft 배경 텍스트 대비는 4.32대1에서 4.93대1이 됐다. 작업 완료 시간의 개선을 측정한 것은 아니다. 조회·편집 분리, 초안 보호, 역할별 가이드는 유지하며 상단 통합, 통계 설정 접기, 조작 및 대비, 로고 이탈 보호를 개선한다. 필터 유지, 페이지 이동 일관성, 실제 경기장 관찰은 후속 과제다.`
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1110" viewBox="0 0 1200 1110" role="img" aria-labelledby="title description" font-family="'Malgun Gothic','Apple SD Gothic Neo',sans-serif"><title id="title">조축ON UX 점검 요약</title><desc id="description">${esc(description)}</desc>${body}</svg>\n`
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>조축ON UX 점검 요약</title><style>body{margin:0;background:#f1f5ef;color:#263d34;font-family:system-ui,'Malgun Gothic',sans-serif;line-height:1.65}main{max-width:1200px;margin:auto;padding:24px}h1{font-size:clamp(24px,4vw,32px);line-height:1.35}img{display:block;width:100%;height:auto}figure{margin:20px 0}.state{border-left:4px solid #28634e;padding:8px 16px;background:white}a{color:#245d47;text-underline-offset:3px}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:16px}.summary section{padding:16px 22px;background:white;border-radius:12px}h2{font-size:20px;margin:0 0 10px}ul{padding-left:22px;margin:0}p{max-width:1000px}a:focus-visible{outline:3px solid #28634e;outline-offset:3px}</style></head><body><main><h1>조축ON · 한눈에 보는 UX 점검</h1><p class="state">${esc(review.date)} · ${esc(review.state)}<br>운영 배포 및 공개 URL 검증을 완료했습니다.</p><p>메뉴와 설명이 결과보다 먼저 쌓이는 문제를 줄입니다. 집계 기준·권한·실제 경기 데이터는 바꾸지 않습니다.</p><figure><a href="${stem}.svg" aria-label="UX 점검 요약 그림 크게 보기"><img src="${stem}.svg" alt="${esc(description)}"></a><figcaption>레이아웃 실측: ${review.width}px 화면, 동일한 가상 데이터와 표 보기 조건. 사용자 작업 시간·만족도 측정 결과가 아닙니다.</figcaption></figure><div class="summary"><section><h2>유지할 강점</h2><ul><li>조회와 편집 분리</li><li>초안과 실패 상태 보호</li><li>역할별 앱·PDF 가이드</li></ul></section><section><h2>이번 개선</h2><ul><li>상단 문맥 통합과 팀 홈 진입</li><li>통계 설정 접기, 경고 유지</li><li>44px 조작 영역과 텍스트 대비</li><li>로고 미저장·저장 중 이탈 보호</li></ul></section><section><h2>후속 검토</h2><ul><li>메뉴 전환 후 조회 조건 유지</li><li>목록 페이지 이동의 일관성</li><li>실제 경기장에서 운영진 사용 관찰</li></ul></section></div><p><a href="../ux-audit-2026-10-20.md">전체 분석과 검증 범위</a> · <a href="../../scripts/Generate-UiUxReview.mjs">그림 생성 원본</a></p></main></body></html>\n`
await fs.mkdir(directory, { recursive: true })
await fs.writeFile(`${directory}${stem}.svg`, svg, 'utf8')
await fs.writeFile(`${directory}${stem}.html`, html, 'utf8')
console.log(`Generated docs/diagrams/${stem}.{svg,html} (${review.state})`)
