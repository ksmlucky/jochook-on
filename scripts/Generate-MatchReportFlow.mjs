import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

// Design-only storyboard. All team/player names and records are fictional.
const out = fileURLToPath(new URL('../docs/diagrams/match-report/', import.meta.url))
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
const text = (x, y, value, size = 16, fill = '#233d34', weight = 400, anchor = 'start') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}">${esc(value)}</text>`
const box = (x, y, w, h, fill = '#fff', r = 12, stroke = '#dce5dc') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`
const badge = (x, y, label, fill = '#e8f1e9') => box(x, y, 56, 24, fill, 7, fill) + text(x + 28, y + 17, label, 11, '#285b48', 700, 'middle')
const button = (x, y, w, label) => box(x, y, w, 44, '#28634e', 10, '#28634e') + text(x + w / 2, y + 28, label, 15, '#fff', 700, 'middle')
const logo = (x, y, letter, fill = '#e5ede8') => box(x, y, 30, 30, fill, 9, fill) + text(x + 15, y + 21, letter, 14, '#285b48', 700, 'middle')
function panel(x, title, label) {
  return box(x, 150, 390, 770, '#fff', 24) + text(x + 24, 189, label, 12, '#687d72', 700) + text(x + 24, 225, title, 24, '#233d34', 700)
}
let body = box(0, 0, 1390, 1160, '#f4f7f1', 0, '#f4f7f1')
body += text(44, 50, '조축ON · 경기 조회 흐름', 30, '#233d34', 800)
body += text(44, 81, '2026-10-21 · 배포 후보 / 운영 확인 전 · 가상 화면 설계 예시', 16, '#567061')
body += text(44, 111, '짧게 찾고 → 점수 흐름 확인 → 필요한 쿼터만 펼치기', 17, '#285b48', 600)
body += panel(44, '경기 기록', '01 / COMPACT LIST')
body += box(64, 248, 350, 42, '#f4f7f1') + text(80, 275, '전체 기간    ·    리그 + 대회', 14)
const listData = [
  ['10월 25일 (일)', '예시 FC', '상대 FC', '2 : 1', '완료'],
  ['10월 18일 (일)', 'A팀', 'B팀', '3 : 3', '완료'],
  ['10월 11일 (일)', '예시 FC', '다른 FC', '0 : 0', '완료'],
  ['10월 4일 (일)', '예시 FC', '연습 FC', '— : —', '작성 중'],
]
listData.forEach((row, i) => {
  const y = 310 + i * 121
  body += box(64, y, 350, 107, i % 2 ? '#f6f8f4' : '#fff', 12)
  body += text(78, y + 24, row[0], 13, '#5b7466', 600) + badge(344, y + 8, row[4])
  body += logo(78, y + 48, i === 1 ? 'A' : '예') + text(116, y + 69, row[1], 14, '#233d34', 700)
  body += box(202, y + 44, 75, 42, '#e7f0e9', 9, '#e7f0e9') + text(239, y + 71, row[3], 20, '#285b48', 800, 'middle')
  body += text(311, y + 69, row[2], 14, '#233d34', 700) + text(395, y + 70, '›', 20, '#567061')
})
body += text(81, 837, '‹ 이전       1 / 3 · 10경기씩       다음 ›', 14, '#567061')
body += text(81, 880, '미입력은 0 : 0과 다르게 표시', 13, '#567061')

body += text(455, 516, '→', 29, '#56836b', 700, 'middle')
body += panel(500, '경기 결과', '02 / SCORE & TIMELINE')
body += text(522, 263, '‹ 목록', 14, '#285b48', 600) + badge(810, 247, '완료')
body += text(695, 305, '10월 25일 · 리그 · 외부 경기', 14, '#567061', 400, 'middle')
body += logo(558, 332, '예') + logo(800, 332, '상')
body += text(575, 390, '예시 FC', 15, '#233d34', 700, 'middle') + text(815, 390, '상대 FC', 15, '#233d34', 700, 'middle')
body += text(695, 378, '2 : 1', 42, '#285b48', 800, 'middle')
body += text(524, 446, '득실점 흐름', 18, '#233d34', 700)
body += `<path d="M545 477V682" stroke="#c3d6c6" stroke-width="2"/>`
const events = [
  ['1쿼터', '득점 · #9 예시 선수', '도움 #8 예시 선수', '1 : 0', '#285b48'],
  ['1쿼터', '실점', '상대 팀 득점', '1 : 1', '#9b4444'],
  ['2쿼터', '득점 · #11 예시 선수', '도움 없음', '2 : 1', '#285b48'],
]
events.forEach((e, i) => {
  const y = 487 + i * 80
  body += `<circle cx="545" cy="${y}" r="6" fill="${e[4]}"/>`
  body += text(565, y, e[0], 11, '#667c6d', 600) + text(565, y + 23, e[1], 14, e[4], 700) + text(565, y + 43, e[2], 12, '#567061')
  body += text(859, y + 22, e[3], 17, '#233d34', 700, 'end')
})
body += button(524, 747, 342, '스쿼드·교체 보기 ↓')
body += box(524, 806, 342, 64, '#f4f7f1') + text(539, 831, '결과 이미지 · 골별 득점자 ← 도움 선수', 13, '#567061') + text(539, 852, '#9 예시 선수 ← #8 예시 선수', 13, '#567061', 600)

body += text(912, 516, '→', 29, '#56836b', 700, 'middle')
body += panel(956, '스쿼드·교체', '03 / QUARTER REPORT')
body += box(976, 251, 350, 44, '#edf4eb') + text(991, 279, '▾ 1쿼터  ·  4-1-2-3', 16, '#285b48', 700)
body += box(976, 309, 350, 342, '#e4eee0', 14, '#cadcc6')
body += `<path d="M990 322H1312V637H990Z M990 479H1312 M1070 322V357H1232V322 M1070 637V602H1232V637" fill="none" stroke="#fff" stroke-width="2"/><circle cx="1151" cy="479" r="42" fill="none" stroke="#fff" stroke-width="2"/>`
const slots = [[1033, 351, 'LW', 7], [1151, 351, 'ST', 9], [1269, 351, 'RW', 11], [1094, 421, 'CM', 8], [1208, 421, 'CM', 6], [1151, 488, 'CDM', 4], [1029, 552, 'LB', 3], [1110, 552, 'CB', 5], [1191, 552, 'CB', 2], [1273, 552, 'RB', 12], [1151, 614, 'GK', 1]]
slots.forEach(([x, y, pos, n]) => {
  const color = ['LW', 'ST', 'RW'].includes(pos) ? '#fae5e7' : ['CM', 'CDM'].includes(pos) ? '#e3f2e6' : pos === 'GK' ? '#fff1cf' : '#e1ebfa'
  body += text(x, y - 25, pos, 9, '#567061', 700, 'middle')
  body += `<circle cx="${x}" cy="${y - 5}" r="15" fill="${color}" stroke="#cad7cc"/>`
  body += text(x, y, String(n), 14, '#233d34', 800, 'middle')
  body += text(x, y + 23, `예시${n}`, 10, '#233d34', 600, 'middle')
  body += text(x, y + 35, n % 2 ? '30대' : '20대', 8, '#567061', 400, 'middle')
  if (pos === 'ST') body += badge(x + 10, y - 27, '교체', '#fff1cf')
})
body += text(991, 677, '교체  ST   #9 예시 선수 → #14 예시 선수', 13, '#567061')
body += text(991, 699, '▸ 선수 명단 · 전체 이름 보기', 12, '#567061')
;[2, 3, 4].forEach((n, i) => { body += box(976, 704 + i * 55, 350, 44, '#f6f8f4') + text(991, 732 + i * 55, `▸ ${n}쿼터 · 스쿼드·교체 펼치기`, 14, '#285b48', 600) })
body += text(991, 892, '전후반은 2개 구간 · 자체전은 A/B 구분', 12, '#567061')
body += box(44, 957, 1302, 151, '#e9f1e6', 16, '#e9f1e6')
body += text(67, 991, '같이 지키는 기준', 20, '#285b48', 700)
body += text(67, 1021, '스쿼드: 원형 등번호 → 이름 → 작은 연령대(경기 연도 기준) / 명단: 번호·이름을 같은 열에 맞춤', 17)
body += text(67, 1052, '결과 공유: 골별 득점자 ← 도움 선수 / 도움 없음 구분 / 기존 합계만 있는 기록은 연결을 추측하지 않음', 16, '#567061')
body += text(67, 1082, '팀 로고는 직접 등록한 이미지 또는 기본 배지 · 이 그림은 설계용이며 운영 앱 캡처가 아님', 15, '#567061')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1390" height="1160" viewBox="0 0 1390 1160" role="img" aria-labelledby="title desc"><title id="title">조축ON 경기 목록에서 결과와 쿼터별 스쿼드로 이어지는 흐름</title><desc id="desc">가상 팀을 이용한 기능 흐름 예시. 목록, 득실점 흐름, 첫 쿼터만 펼친 작전판. 실제 운영 데이터가 아니다.</desc><g font-family="Malgun Gothic,Apple SD Gothic Neo,sans-serif">${body}</g></svg>`
await fs.mkdir(out, { recursive: true })
await fs.writeFile(`${out}/flow.svg`, svg)
// Set JOCHOOK_SHARP_MODULE to the bundled Sharp directory when it is not installed locally.
try {
  const sharp = createRequire(import.meta.url)(process.env.JOCHOOK_SHARP_MODULE || 'sharp')
  await sharp(Buffer.from(svg)).png().toFile(`${out}/flow.png`)
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error
  console.log('PNG renderer unavailable; set JOCHOOK_SHARP_MODULE and rerun to refresh flow.png.')
}
await fs.writeFile(`${out}/index.html`, `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>조축ON 경기 조회 흐름</title><style>body{margin:24px;background:#f4f7f1;color:#233d34;font-family:system-ui,sans-serif;line-height:1.65}main{max-width:1390px;margin:auto}img{width:100%;height:auto}p{max-width:900px}.state{background:#e9f1e6;padding:12px 18px;border-radius:12px}a{color:#28634e}</style><main><h1>경기 목록 → 결과 → 쿼터별 스쿼드</h1><p class="state">2026-10-21 · 배포 후보 / 운영 확인 전 · 모두 가상 팀과 선수. 새 화면 흐름의 설계 예시이며 실제 운영 화면 캡처가 아닙니다.</p><p>목록에서는 날짜와 점수를 빠르게 확인합니다. 상세에서 확인된 득실점 순서를 보고, 첫 구간이 열린 스쿼드에서 필요한 쿼터만 추가로 펼칩니다. 기존 합계 기록의 득실점 순서는 추측하지 않습니다. 등번호는 같은 크기의 원 안에, 이름과 경기 연도 기준 연령대는 아래에 표시합니다. 전체 명단은 번호·이름을 같은 열에 맞춰 읽습니다. 결과 이미지는 골별 득점자와 도움을 연결하고, 기존 합계만 있는 기록의 연결은 추측하지 않습니다.</p><a href="flow.svg">원본 SVG 크게 보기</a><figure style="margin:20px 0"><img src="flow.svg" alt="컴팩트 경기 목록, 득실점 타임라인, 1쿼터만 열린 스쿼드의 세 단계 가상 화면"><figcaption>팀 로고는 등록 이미지 또는 기본 배지를 사용합니다. 다른 서비스의 로고와 선수 사진을 사용하지 않았습니다.</figcaption></figure><p><a href="../../match-report-ux-2026-10-20.md">기능 명세·검증 기준</a> · <a href="../../agents/ux-expert.md">UX 전문가 역할 정의</a></p></main></html>`)
console.log('Generated fictional match-report storyboard: SVG and HTML.')
