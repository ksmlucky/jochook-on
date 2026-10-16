import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const out = fileURLToPath(new URL('../docs/diagrams/project-review-2026-10-16/', import.meta.url))
await fs.mkdir(out, { recursive: true })
const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]))
const findings = [
  { title:'잘 갖춘 기반', color:'#24684f', bg:'#eaf3ed', lines:['팀별 데이터·감독/코치 권한 분리','저장 중복 방지 · 수정 충돌 감지','24시간 초안 · 변경 전후 이력','실제 출전 기준 통계 · 대회 연결'] },
  { title:'불편함의 원인', color:'#8a5b24', bg:'#fff3df', lines:['기록보다 먼저 나오는 긴 설정','휴대폰에서 좌우로 밀어야 하는 표','경기 수정 때 반복되는 기본 정보','처음 접속했을 때 할 일 안내 부족'] },
  { title:'이번 로컬 개선', color:'#285f8a', bg:'#eaf2fb', lines:['기간·선수 조건은 요약 후 펼치기','모바일 기록 간단 보기 + 표 전환','기존 경기 기본 정보 접기','오류가 생기면 관련 입력 다시 펼침'] },
]
let s = [`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1050" viewBox="0 0 1200 1050" role="img" aria-labelledby="title desc"><title id="title">조축ON 프로젝트 진단과 개선 순서</title><desc id="desc">기존 데이터 보호 기반을 유지하면서 모바일 조회를 간결하게 개선했다. 다음은 운영 백업과 계정 복구, 첫 화면과 선수 활동 관리다. 이번 변경은 로컬 검증이며 미배포다.</desc><rect width="1200" height="1050" fill="#f5f7f3"/><g font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif">`]
const text = (x,y,value,size=20,color='#223c33',weight=400) => s.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(value)}</text>`)
const rect = (x,y,w,h,fill='#fff') => s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${fill}"/>`)
text(48,49,'JOCHOOK ON  /  PROJECT REVIEW',17,'#496b5c',700)
text(48,103,'기능은 충분해졌고, 이제 사용 흐름을 다듬을 때',35,'#223c33',700)
text(48,141,'2026.10.16  ·  코드·문서 검토 + 가상 데이터 화면 검증  ·  로컬 변경 / 운영 미반영',18,'#5c7066')
findings.forEach((item,index)=>{const x=48+index*374;rect(x,178,356,248,item.bg);text(x+22,218,item.title,24,item.color,700);item.lines.forEach((line,i)=>text(x+22,264+i*40,line,18))})
rect(48,450,1104,154)
text(72,488,'모바일 기록 접근 길이',22,'#223c33',700)
text(72,522,'390px 가상 화면 · 페이지 위에서 첫 선수까지',17,'#5c7066')
s.push('<rect x="490" y="476" width="450" height="22" rx="6" fill="#d5ddd5"/><rect x="490" y="526" width="339" height="22" rx="6" fill="#347b60"/>')
text(962,494,'1,809px',20);text(850,545,'1,363px',20,'#24684f',700)
text(72,570,'약 25% 감소 · 실제 입력 시간·만족도 개선은 팀원 확인이 필요',18,'#5c7066')
text(48,651,'다음 순서 — 추가 기능보다 운영과 일상 사용부터',25,'#223c33',700)
const next = [
 ['1','기록을 지키기','자동 백업 대안·독립 사본·복원 시험','#fff3df'],
 ['2','접속을 회복하기','본인 확인을 갖춘 운영진 계정 복구','#fff3df'],
 ['3','시작을 쉽게 하기','최근 경기·이어서 작성·내 기록 바로가기','#eaf3ed'],
 ['4','운영 부담 줄이기','선수 활동 중지/복귀·안전한 경기 복사','#eaf3ed'],
]
next.forEach(([n,title,body,bg],i)=>{const x=48+(i%2)*564,y=681+Math.floor(i/2)*122;rect(x,y,540,106,bg);text(x+20,y+36,n,24,'#496b5c',700);text(x+58,y+36,title,22,'#223c33',700);text(x+58,y+73,body,18)})
text(48,961,'인프라 제안: 현 구조 유지 → 백업·복구·지연 측정 → 필요할 때 이전',20,'#223c33',700)
text(48,996,'검증: 프론트 245개·빌드·320/390px 화면  |  미검증: 실제 iPhone·운영 DB 통합·클라우드 재조회',16,'#5c7066')
text(48,1024,'미구현 제안과 로컬 수정은 구분했습니다. 실제 회원 정보·비밀값을 포함하지 않습니다.',16,'#5c7066')
s.push('</g></svg>')
const svg=s.join('\n')
await fs.writeFile(`${out}/overview.svg`,svg)
const detail = [
 ['이번에 바꾼 것','기간/선수 필터는 적용 조건을 남기고 접습니다. 기간을 바꾸고 조회하지 않았다면 미적용 표시가 유지됩니다. 모바일 선수 기록은 간단 보기로 시작하며 표와 같은 정렬·계산을 사용합니다. 기존 경기 기본 정보는 접고 신규 경기는 펼칩니다. 필수값·대회 조회 오류는 숨기지 않습니다.'],
 ['좋은 부분','선수·경기·대회·계정을 팀 단위로 분리하고 서버에서도 권한을 확인합니다. 경기 저장 영수증, 낙관적 버전 검사, 전후 변경 이력, 초안 보관이 있어 모바일 네트워크에서 중요한 보호 장치가 마련돼 있습니다. 통계는 계획이 아니라 실제 기록을 사용합니다.'],
 ['가장 중요한 운영 과제','최신 운영 문서 기준으로 수동 백업·격리 복원 검증은 성공했습니다. 그러나 무료 계정의 daily 예약 제한으로 자동 백업과 PC 밖 독립 사본은 아직 미설정입니다. 이번에는 클라우드 상태를 재조회하지 않았습니다. 계정 복구도 앱에서 제공하지 않아 운영자 의존도가 높습니다.'],
 ['추천할 기능','① 최근 경기/이어서 작성 중심의 역할별 첫 화면 ② 선수 활동 중지·복귀 ③ 명단·장소만 가져오는 이전 경기 복사 ④ 공유용 스쿼드·결과 이미지. 득점·출석·완료 상태를 새 경기에 그대로 복사하지 않는 정책이 필요합니다. 개인 기록 고정은 코드 공유 회원에게 별도 신원 정보가 없다는 점을 고려해야 합니다.'],
 ['코드와 배포의 다음 개선','빌드의 주 JS는 약 576kB(압축 약164kB)입니다. 메뉴별 지연 로딩은 느린 휴대폰의 측정 결과를 보고 적용할 후보입니다. 경기 편집의 긴 상태 처리와 누적 CSS를 기능별로 나누되 저장·초안 회귀 검증을 유지합니다. 현 Spring/React/MySQL 구조를 유지하면서 시험 환경→검증→운영 승인 절차를 강화하는 편이 지금 규모에 적합합니다.'],
 ['아직 하지 않은 것','운영 배포·실제 DB 시험 수정·마이그레이션·서버 이전·계정/권한 변경을 하지 않았습니다. 실제 iPhone Safari, 실제 서버에 대한 저장 통합 및 클라우드 성능/요금은 이번 작업에서 검증하지 않았습니다. 보안 검토는 관련 코드 읽기이며 침투 시험이 아닙니다.'],
]
await fs.writeFile(`${out}/index.html`,`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>조축ON 프로젝트 리뷰 · 2026.10.16</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f7f3;color:#223c33;font-family:system-ui,'Malgun Gothic',sans-serif;line-height:1.75}main{max-width:1200px;margin:auto;padding:24px}header{padding:16px 0}h1{font-size:clamp(24px,4vw,36px);line-height:1.35;margin:8px 0}p{margin:8px 0}.tag{display:inline-block;border-radius:30px;padding:5px 14px;background:#fff0ce;color:#77531e;font-size:14px;font-weight:700}.diagram{border-radius:20px;overflow:hidden;border:1px solid #dce4da}.diagram svg{display:block;width:100%;height:auto}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:24px 0}article{padding:24px;background:white;border:1px solid #dce4da;border-radius:16px}h2{font-size:21px;margin:0 0 12px}.evidence{background:#eaf3ed;padding:24px;border-radius:16px}a{color:#285d86;text-underline-offset:3px}details{margin:20px 0}summary{cursor:pointer;min-height:44px;font-weight:700}footer{padding:24px 0;color:#617367;font-size:14px}@media(max-width:700px){main{padding:16px}.cards{grid-template-columns:1fr}article{padding:20px}.diagram{overflow:auto}.diagram svg{min-width:760px}}</style><main><header><span class="tag">로컬 개선 완료 · 운영 미배포</span><h1>조축ON, 무엇을 잘했고<br>무엇부터 더 다듬을까요?</h1><p>기록 보호 기반을 유지하면서, 사용자가 결과와 다음 행동을 빨리 찾도록 개선합니다.</p></header><section class="diagram" aria-label="프로젝트 진단 요약 그림">${svg}</section><div class="cards">${detail.map(([title,body])=>`<article><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`).join('')}</div><section class="evidence"><h2>검증 근거와 확인할 범위</h2><p>프론트 기존 테스트 245개와 TypeScript/Vite 빌드 통과. 가상 데이터로 작은 화면, 정렬 전환, 상세 복귀, 기간 오류와 미적용 표시, 기본 정보 오류 펼침, 회원의 수정 버튼 미노출을 확인했습니다.</p><p>390px 비교는 같은 가상 데이터·기본 조건의 첫 행 위치를 DOM으로 측정했습니다. 실제 체감 시간 측정은 아닙니다.</p><p>자세한 코드 근거·인수 기준·가이드 갱신 계획은 <a href="../../project-review-2026-10-16.md">분석 보고서</a>를 참고하세요.</p></section><details><summary>검증용 모바일 화면 보기 (가상 데이터)</summary><p><a href="stats-mobile-after.png">개선 화면</a> · <a href="stats-mobile-before.png">개선 전 화면</a></p><img src="stats-mobile-after.png" alt="가상 선수로 검증한 개선 후 선수 기록 화면" style="max-width:390px;width:100%;height:auto"></details><footer>분석 기준일 2026.10.16 · 생성 원본 scripts/Generate-ProjectReview.mjs · 실제 회원 데이터/비밀값 없음<br>서버 상태는 기존 운영 문서 기준이며 이번 UX 수정은 운영 앱에 반영되지 않았습니다.</footer></main></html>`)
console.log('Generated project review SVG + HTML')
if (process.env.JOCHOOK_SHARP_MODULE) {
  const sharp = createRequire(import.meta.url)(process.env.JOCHOOK_SHARP_MODULE)
  await sharp(Buffer.from(svg)).png().toFile(`${out}/overview.png`)
  console.log('Rendered project review PNG')
}
