// Source-controlled workflow illustration. No production screenshots or member data.
import fs from 'node:fs/promises'
const out = new URL('../docs/diagrams/mobile-workflow-guide.svg', import.meta.url)
const releaseCommit = 'b9d8738f080d49911b31fcf9ef42b463a23478d8'
const releaseLabel = `2026.10.15 기능확장판 · 운영 ${releaseCommit.slice(0,7)}`
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="980" viewBox="0 0 1400 980" role="img" aria-labelledby="title desc"><title id="title">조축ON 모바일 작전판과 사용 가이드 흐름</title><desc id="desc">${releaseLabel}. 주요 메뉴 네 개, 02·03 스쿼드 전체보기와 초안 편집, 단계별 서버 저장, 감독·코치와 회원의 역할별 가이드. 운영 웹/API 커밋 ${releaseCommit}, Flyway V23 적용 확인.</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 L9 5 L1 9" fill="none" stroke="#80968a" stroke-width="1.5"/></marker></defs><rect width="1400" height="980" fill="#f7f8f4"/><g font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif">`
function text(x,y,value,size=20,color='#243c34',weight=400,anchor='start') { svg += `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}">${esc(value)}</text>` }
function rect(x,y,w,h,fill='#fff') { svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${fill}" stroke="#d1ded4"/>` }
function box(x,y,w,h,title,lines,fill='#fff',size=19) { rect(x,y,w,h,fill); text(x+20,y+35,title,23,'#28654d',700); lines.forEach((line,i)=>text(x+20,y+70+i*29,line,size,'#52695d')) }
function arrow(x,y,xx,yy) { svg += `<path d="M${x} ${y} L${xx} ${yy}" fill="none" stroke="#80968a" stroke-width="2" marker-end="url(#arrow)"/>` }
text(54,43,'JOCHOOK ON / 조축ON',20,'#28654d',700)
text(1346,43,releaseLabel,18,'#66766d',400,'end')
text(54,101,'휴대폰에서 보고, 고치고, 저장하기',36,'#243c34',700)
text(54,141,'작전판에서 수정한 내용은 먼저 초안에 반영됩니다. 서버 저장은 기존 단계별 버튼으로 합니다.',21,'#52695d')
const menus=[['선수단','명단 · 선호 포지션'],['경기 기록','01~04 입력 · 스쿼드'],['선수 기록','시즌별 기록 조회'],['사용 가이드','역할별 설명 · PDF']]
menus.forEach(([title,line],i)=>box(54+i*330,176,300,108,title,[line],i===3?'#e8f3eb':'#fff'))
rect(54,318,800,391,'#eef4f0');text(78,351,'02 계획 / 03 실제 출전 · 스쿼드 한눈에 보기',25,'#28654d',700)
box(78,377,227,117,'① 전체보기 열기',['11명 배치를 한 화면에','6종 포메이션 지원'],'#fff',17)
box(338,377,227,117,'② 쿼터·팀 선택',['1~4쿼터 / 자체전 A·B','팀별 포메이션 표시'],'#fff',17)
box(598,377,232,117,'③ 자리 눌러 편집',['02 배치 · 03 골·도움','선발·교체 별도 입력'],'#fff',17)
arrow(306,434,334,434);arrow(566,434,594,434);arrow(713,495,713,527)
box(78,534,752,146,'입력 완료 · 작전판으로 → 전체보기 닫기',['입력은 현재 초안에 유지 · 닫기는 취소나 서버 저장이 아님','원래 화면에서 계획 저장 / 출전 기록 저장 버튼 사용','조회 회원은 작전판·상세 기록만 확인'],'#fff',20)
rect(884,318,462,391,'#edf3f8');text(908,351,'사용 가이드 · 계정 권한 기준',25,'#285d86',700)
box(908,377,414,117,'감독·코치 → 운영진용',['등록·편집·단계별 저장·초안 복원','팀 접속 관리와 운영 흐름'],'#fff',19)
box(908,518,414,117,'회원·코드 접속 → 회원용',['선수단·경기·스쿼드·선수 기록 조회','모바일 목차 / 이전·다음 / PDF'],'#fff',19)
text(908,676,'선수 직책과 실제 로그인 권한은 별개',19,'#52695d')
box(54,753,625,147,'탭의 임시 초안 · 최대 24시간',['같은 계정·팀으로 돌아와 이어서 작성','직접 로그아웃 시 삭제 · 다른 기기와 동기화 안 됨','서버 저장이 아니므로 단계별 저장 버튼 확인'],'#fff',20)
box(714,753,632,147,'서버 저장 · V23 영수증',['경기 + 변경 이력 + 영수증을 함께 저장','응답 유실은 저장 결과부터 확인 · 같은 요청 재시도','수정 충돌은 초안 보존 · 자동 덮어쓰기 차단'],'#e8f3eb',20)
text(54,947,'실제 회원 정보 없는 설명 그림 · 사용 가이드 원고와 PDF는 같은 원본에서 생성',17,'#66766d')
svg+='</g></svg>'
await fs.mkdir(new URL('../docs/diagrams/', import.meta.url), { recursive: true })
await fs.writeFile(out, svg)
console.log(out.pathname)
