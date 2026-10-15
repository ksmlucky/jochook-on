import fs from 'node:fs/promises'
const out = new URL('../docs/diagrams/match-draft-recovery.svg', import.meta.url)
const esc = text => text.replaceAll('&','&amp;').replaceAll('<','&lt;')
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="780" viewBox="0 0 1200 780" role="img" aria-labelledby="title desc"><title id="title">조축ON 경기 초안 복원과 저장 재시도</title><desc id="desc">로컬 구현. 같은 탭의 계정과 팀별 임시 초안, UUID 저장 요청, 서버의 완료 영수증 확인 및 동일 요청 재시도. 운영 미반영.</desc><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill="none" stroke="#5c806e" stroke-width="1.5"/></marker></defs><rect width="1200" height="780" fill="#f7f8f4"/><g font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif">`
function text(x,y,t,size=19,color='#263e33',bold=false) {svg+=`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${bold?700:400}">${esc(t)}</text>`}
function box(x,y,title,lines,fill='#fff') {svg+=`<rect x="${x}" y="${y}" width="340" height="140" rx="16" fill="${fill}" stroke="#bacfc0"/>`;text(x+20,y+33,title,23,'#28654d',true);lines.forEach((t,i)=>text(x+20,y+67+i*27,t,17,'#52695d'))}
function arrow(x,y,xx,yy){svg+=`<path d="M${x} ${y} L${xx} ${yy}" stroke="#5c806e" stroke-width="2" marker-end="url(#arrow)" fill="none"/>`}
text(40,43,'JOCHOOK ON / 조축ON',20,'#28654d',true);text(840,43,'로컬 구현 · 운영 미반영',19,'#68786f')
text(40,94,'입력은 이어서, 같은 저장 요청은 한 번만',34,'#263e33',true)
text(40,127,'임시 초안 보관과 서버 저장을 구분합니다. 계정·팀·수정 버전은 기존 권한 경계를 유지합니다.',19,'#52695d')
box(40,165,'01 입력 중 임시 보관',['같은 탭 · 계정 + 팀별 1개','최대 24시간 · 직접 로그아웃 시 삭제','비밀번호·팀 코드·인증 토큰 제외'])
box(430,165,'02 복원 여부 선택',['새로고침 / 세션 만료 뒤 재접속','서버 version 일치 → 이어서 입력','불일치 → 초안 보존 · 덮어쓰기 차단'])
box(820,165,'03 단계별 저장',['UUID + 정확한 요청 사본 보관','POST/PUT에 같은 요청 번호 전달','CSRF · 운영진 권한 · 팀 범위 확인'])
arrow(380,235,425,235);arrow(770,235,815,235);arrow(990,305,990,390)
box(820,395,'04 서버에서 한 번만',['팀 + 계정 + UUID 고유 키','경기 · 변경 이력 · 영수증 함께 저장','실패 시 전체 롤백'],'#e8f3eb')
box(430,395,'05 응답을 못 받았다면',['완료 영수증과 현재 기록부터 확인','미완료 → 같은 UUID·내용 재전송','내용 변경 / 후속 수정·삭제는 차단'])
box(40,395,'06 결과 확인 후 계속',['성공 → 초안 정리 · 다음 단계','미확인 → 초안 보관 · 입력 잠금','충돌 → 최신 기록 조회 / 명시 폐기'])
arrow(820,465,775,465);arrow(430,465,385,465)
text(40,603,'보관 위치',23,'#28654d',true)
text(40,639,'브라우저 sessionStorage: 현재 초안 · 원래 version · 미확인 저장 요청',19)
text(40,672,'MySQL match_save_requests (V23): 요청 지문 · 결과 경기 ID/version · 시각',19)
text(40,720,'실제 회원 자료를 넣지 않은 설명 그림입니다. 문서 공개와 운영 배포는 별도입니다.',18,'#68786f')
svg+='</g></svg>';await fs.writeFile(out,svg);console.log(out.pathname)
