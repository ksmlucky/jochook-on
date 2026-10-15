// Documentation-only diagram; all examples are synthetic.
import fs from 'node:fs/promises'
const target = new URL('../docs/diagrams/player-season-detail.svg', import.meta.url)
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="980" viewBox="0 0 1440 980" role="img" aria-labelledby="title desc"><title id="title">조축ON 선수별 시즌 상세 조회 흐름</title><desc id="desc">로컬 개발 기능. 시즌 목록에서 선수를 선택하고 경기별 기여 기록과 원본을 조회한다. 현재 운영 버전 b9d8738과 구분한다.</desc><rect width="1440" height="980" fill="#f6f8f3"/><g font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif">'
function text(x,y,s,size=21,color='#274e40',weight=400){svg+=`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(s)}</text>`}
function card(x,y,w,h,title,lines,fill='#fff'){svg+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="${fill}" stroke="#d3e1d7"/>`;text(x+24,y+42,title,25,'#245f49',700);lines.forEach((s,i)=>text(x+24,y+86+i*34,s,20,'#52675d'))}
text(55,50,'JOCHOOK ON · 조축ON',22,'#245f49',700)
text(935,50,'2026.10.15 · 로컬 개발 / 운영 미반영',20,'#6b776c')
text(55,114,'이 기록은 어느 경기에서 나왔을까?',38,'#203e32',700)
text(55,160,'선수 합계 → 경기별 기록 → 원본 경기. 선택한 집계 범위를 유지하며 확인해요.',23)
card(55,210,410,335,'01  시즌 목록',['연도·월 · 리그+대회 · 완료','열 제목으로 양방향 정렬','리그에는 자체전도 포함','','#8  예시 선수   3골 · 2도움','선수 이름이나 등번호를 누르세요.'])
card(515,210,410,335,'02  선수별 상세',['연도·월과 리그·대회 바로 선택','상단: 누적 / 1~4쿼터당 선택','경기 카드: 실제 득점·도움','','10.10  예시 팀전  ·  2골 / 1도움','카드에서 원본 경기 보기'])
card(975,210,410,335,'03  원본 경기 조회',['01  투표와 실제 출석','02  계획 스쿼드','03  실제 출전·골·도움','04  스코어와 코멘트','','이 경로에서는 읽기만 가능해요.'])
text(478,381,'→',32);text(938,381,'→',32)
card(55,585,640,154,'돌아가도 선택은 그대로',['상세 → 목록 : 필터·검색·정렬 유지','원본 → 상세 : 선택 선수·페이지와 포커스 복귀'],'#eaf3e8')
card(725,585,660,154,'집계와 상세는 같은 기준',['실제 참석 또는 출전한 경기만 포함','교체 0.5Q · 자체전 이동도 출전 경기 한 번'],'#eaf1f8')
card(55,778,1330,135,'운영 자료 보호와 배포 기준',['DB 구조 변경 없이 조회 기능 추가 · 실제 자료 대신 가상 데이터로 검증','운영 앱·공유용 가이드는 b9d8738 / 1.1 유지. 새 기능 배포 때 가이드도 함께 갱신.'])
text(55,950,'기획·화면·API 명세: docs/player-season-detail.md  |  실제 회원 정보 없는 설명 그림',18,'#65786a')
svg+='</g></svg>'
await fs.writeFile(target,svg)
console.log(target.pathname)
