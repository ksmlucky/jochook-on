// Development documentation only: no actual tournament, member or account data.
import fs from 'node:fs/promises'

const target = new URL('../docs/diagrams/tournaments-and-completion-review.svg', import.meta.url)
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1300" viewBox="0 0 1500 1300" role="img" aria-labelledby="title desc"><title id="title">조축ON 대회 관리와 경기 완료 전 점검 흐름</title><desc id="desc">로컬 구현이며 운영 미반영. 감독과 코치는 대회 등록, 경기 연결, 기존 4쿼터 기록, 완료 전 점검과 명시적 완료를 진행한다. 회원은 대회 및 경기와 선수 기록을 조회한다. 실제 대회 날짜나 회원 정보는 포함하지 않는다.</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M1 1 L9 5 L1 9" fill="none" stroke="#6d8f7e" stroke-width="1.6"/></marker></defs><rect width="1500" height="1300" fill="#f6f8f3"/><g font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif">'
function text(x, y, value, size = 21, color = '#52675d', weight = 400) { svg += `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(value)}</text>` }
function rect(x, y, w, h, fill = '#fff') { svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="${fill}" stroke="#cfded3"/>` }
function card(x, y, w, h, title, lines, fill = '#fff') { rect(x, y, w, h, fill); text(x + 24, y + 43, title, 26, '#245f49', 700); lines.forEach((line, i) => text(x + 24, y + 84 + i * 32, line)) }
function arrow(x, y, xx, yy) { svg += `<path d="M${x} ${y} L${xx} ${yy}" stroke="#6d8f7e" stroke-width="2.5" fill="none" marker-end="url(#arrow)"/>` }

text(55, 48, 'JOCHOOK ON · 조축ON', 22, '#245f49', 700)
text(987, 48, '2026.10.15 · 로컬 구현 / 운영 미반영', 21, '#68776c')
text(55, 114, '대회를 만들고, 경기와 선수 기록을 함께 모아요', 39, '#203e32', 700)
text(55, 162, '감독·코치는 등록과 수정, 회원은 조회. 경기 입력은 기존 4쿼터 흐름을 유지해요.', 23, '#365b49')

card(55, 212, 430, 232, '01  대회 등록', ['필수: 대회 이름 · 시작일 · 종료일', '선택: 장소 · 참가 부문 · 메모', '한 대회에 여러 경기 연결', '대회 삭제는 이번 범위에서 제외'])
card(535, 212, 430, 232, '02  경기 연결', ['대회 목록에서 경기 보기', '경기 기본 정보의 대회 선택', '예선·결승 등 단계는 선택 입력', '대회 미지정이면 일반 경기'])
card(1015, 212, 430, 232, '03  기존 방식으로 경기 입력', ['01 투표·실제 출석', '02 계획 스쿼드 → 03 실제 출전', '04 스코어·코멘트', '대회 경기는 외부 경기로 기록'])
arrow(491, 326, 526, 326); arrow(971, 326, 1006, 326); arrow(1230, 451, 1230, 490)

rect(55, 500, 1390, 252, '#eef4e8')
text(79, 547, '04  완료 전 점검', 28, '#245f49', 700)
text(79, 584, '안내를 보고 해당 단계·쿼터로 이동해 확인해요. 창을 여는 것만으로 저장하지 않아요.', 22)
text(79, 632, '투표와 실제 출석', 23, '#245f49', 700)
text(79, 667, '참석 예정인데 실제 출석 미확인', 20)
text(79, 699, '참석·지각했지만 출전 기록 없음', 20)
text(555, 632, '쿼터별 선발 배치', 23, '#245f49', 700)
text(555, 667, '팀·쿼터별 빈 자리와 선발 수', 20)
text(555, 699, '교체는 선발 수에 중복 집계 안 함', 20)
text(1025, 632, '스코어와 득점 기록', 23, '#245f49', 700)
text(1025, 667, '최종 스코어 미입력', 20)
text(1025, 699, '선수별 골 합계와 스코어 차이', 20)
arrow(380, 759, 380, 794)

card(55, 804, 650, 226, '05  운영진이 기록 완료', ['확인 후 기록 완료 · 목록으로', '안내가 남아도 자동으로 완료를 막지 않음', '필수값·중복 배치 등 기존 저장 검증은 유지', '단계별 중간 저장도 계속 사용'], '#fff')
card(785, 804, 660, 226, '06  회원과 운영진이 조회', ['대회 → 경기 보기: 선택한 대회 경기 목록', '선수 기록: 시즌과 대회 조건을 함께 적용', '선수별 상세 → 원본 경기로 기록 대조', '기존 집계 기준과 0.5쿼터 교체 계산 유지'], '#eaf1f8')
arrow(713, 918, 776, 918)

rect(55, 1070, 1390, 150)
text(79, 1112, '이번 범위와 후속 작업을 구분해요', 25, '#245f49', 700)
text(79, 1150, '대회 기간 밖 경기 날짜는 안내만 해요. 전·후반, 경기 길이, 승부차기, 연령 자격 판정은 후속 설계예요.', 21)
text(79, 1185, '운영 앱 b9d8738 · 가이드 1.1 유지. 다음 기능 배포를 준비할 때 회원·운영진 가이드를 함께 갱신해요.', 21)
text(55, 1260, '요구사항: docs/tournaments-and-completion-review.md  ·  실제 회원·대회 정보 없는 설명 그림', 19, '#68776c')
svg += '</g></svg>\n'
await fs.writeFile(target, svg)
console.log(target.pathname)
