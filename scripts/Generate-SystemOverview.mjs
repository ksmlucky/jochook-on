import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Tracked diagrams are regenerated in the repository, regardless of shell cwd.
const out = fileURLToPath(new URL('../docs/diagrams/system-overview/', import.meta.url));
await fs.mkdir(out, {recursive:true});
// Confirm these release fields only after live API/web and data preservation checks.
const releaseLabel = '2026.10.19 최근 경기·선수 기록 간결하게';
const releaseStatus = '웹a3bfd95 / API1519c9d · 운영 확인';
const schemaLabel = 'V32';
const guideLabel = '1.14';
const C={ink:'#203a33',muted:'#566d65',line:'#8b9e96',green:'#246b51',mint:'#e7f3eb',blue:'#285d86',sky:'#edf4fa',amber:'#8b5b18',cream:'#fff4df',paper:'#ffffff',bg:'#f7f8f4',border:'#d8e3dc'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
let a=[];
function text(x,y,lines,{size=22,color=C.ink,weight=400,gap=32,anchor='start'}={}){
  for(const [i,line] of (Array.isArray(lines)?lines:[lines]).entries())a.push(`<text x="${x}" y="${y+i*gap}" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}">${esc(line)}</text>`);
}
function rect(x,y,w,h,{fill=C.paper,stroke=C.border,r=18,dash=false}={}){a.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"${dash?' stroke-dasharray="8 6"':''}/>`)}
function box(x,y,w,h,title,lines=[],{fill=C.paper,accent=C.green,size=21}={}){
  rect(x,y,w,h,{fill});a.push(`<rect x="${x}" y="${y+20}" width="5" height="${h-40}" rx="2" fill="${accent}"/>`);
  text(x+24,y+39,title,{size:25,weight:600,color:accent});text(x+24,y+79,lines,{size,gap:31});
}
function arrow(x1,y1,x2,y2,label='',{color=C.line,dash=false,labelY=-14}={}){
  a.push(`<path d="M ${x1} ${y1} L ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="2.2" marker-end="url(#arrow)"${dash?' stroke-dasharray="7 5"':''}/>`);
  if(label)text((x1+x2)/2,(y1+y2)/2+labelY,label,{size:18,anchor:'middle',color:C.muted});
}
function tag(x,y,label,{fill=C.mint,color=C.green,w=154}={}){rect(x,y,w,34,{fill,stroke:fill,r:17});text(x+w/2,y+23,label,{size:17,weight:600,color,anchor:'middle'})}
function begin(n,title,subtitle){a=[`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="940" viewBox="0 0 1400 940" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">${esc(subtitle)}</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="${C.line}" stroke-width="1.6"/></marker></defs><g font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, sans-serif"><rect width="1400" height="940" fill="${C.bg}"/>`];text(54,43,'JOCHOOK ON  /  조축ON',{size:19,weight:600,color:C.green});text(1346,43,`${n} / 4   ·   2026.10.19`,{size:17,anchor:'end',color:C.muted});text(54,97,title,{size:36,weight:700});text(54,130,subtitle,{size:20,color:C.muted});}
async function end(name){text(54,918,`${releaseLabel} · ${releaseStatus} · DB ${schemaLabel}`,{size:16,color:C.muted});text(1346,918,'실제 회원 정보·접속 비밀값 제외',{size:16,anchor:'end',color:C.muted});a.push('</g></svg>');await fs.writeFile(path.join(out,name+'.svg'),a.join('\n'));}

begin('01','시스템 아키텍처 · 어디에서 실행될까?','휴대전화는 화면을 보여주고, 실제 선수·경기 자료는 클라우드 DB에 저장됩니다.');
rect(365,164,980,478,{fill:'#f0f5f0',stroke:'#b8cec0',r:24});
text(393,202,'Northflank Cloud  /  US - Central  /  Default 프로젝트',{size:24,weight:600});
tag(1090,221,'무료 Sandbox · 시범 운영',{w:225});
box(54,285,240,239,'휴대전화 · PC',['React 화면 실행','Safari / Chrome','홈 화면 설치(PWA)','인터넷 연결 필요'],{fill:C.paper,size:21});
box(395,285,267,268,'웹 · Caddy 2',['jochook-on-web',':8080 · 내부 HTTP','React 19 + TypeScript','Vite로 만든 파일 제공','/api 요청은 API로 전달'],{fill:C.paper,size:20});
box(729,285,277,268,'API · Spring Boot',['jochook-on-api',':8080 · 외부 직접 접근 X','Java 21 / Boot 4.1.1','Spring Security + JPA','팀·기록·시즌 통계 처리'],{fill:C.paper,size:20});
box(1073,285,244,268,'DB · MySQL',['MySQL 8.4.11',`hana_fc · ${schemaLabel}`,'비공개 네트워크','TLS 인증서 검증','대회·경기·이력·영수증'],{fill:C.paper,size:20});
arrow(294,386,393,386,'HTTPS');arrow(662,386,727,386,'/api');arrow(1006,386,1071,386,'TLS');
text(395,583,['외부 HTTPS 인증서는 Northflank가 처리 · API와 DB는 내부 경로로 연결','세션 쿠키 + CSRF + 팀 범위 검증 · API는 현재 1개 인스턴스'],{size:20,color:C.muted,gap:31});
box(54,681,625,185,'개발 PC · 운영과 별개',['Vite :5173 → Spring Boot :8080 → 로컬 MySQL','이 PC는 네이티브 MySQL 사용 · Docker 구성도 보유','로컬 DB와 운영 DB는 자동 동기화되지 않음'],{fill:C.sky,accent:C.blue,size:21});
box(714,681,631,185,'아직 운영 경로에 없는 것',['Oracle 도쿄: 서버 확보·이전 검증 전의 후보','Cloudflare: 계정 가입 완료, 운영 연결 전','Capacitor: 앱 준비 단계 · 스토어/TestFlight 미배포'],{fill:C.cream,accent:C.amber,size:21});
await end('01-system-architecture');

begin('02','업무 흐름도 · 한 경기를 어떻게 남길까?','회원은 조회하고, 감독·코치는 선수와 경기 기록을 관리합니다.');
box(54,166,397,143,'서비스 관리자',['팀 생성 · 감독 지정 · 운영진 복구','본인 확인 후 30분·일회용 링크'],{fill:C.sky,accent:C.blue,size:21});
box(501,166,397,143,'감독 · 코치',['개인 계정 로그인 · 기록 입력/수정','감독이 코치 임명 · 팀 접속 정보 발급'],{fill:C.mint,size:21});
box(948,166,397,143,'회원',['팀 코드 + 팀 비밀번호로 조회','선수 · 경기 · 스쿼드 · 시즌 기록'],{size:21});
arrow(452,240,498,240);arrow(899,240,945,240);
text(54,342,'팀 접속 → 우리 팀 홈 → 최근 경기·선수 기록 / 운영진은 새 기록·이어서 작성',{size:21,color:C.green,weight:600});
const stages=[
 ['01 · 참석 명단',['날짜·시각 · 리그/대회 선택','전·후반 또는 4쿼터 선택','선택하면 참석도 함께 반영','자체전 A·B팀 먼저 체크']],
 ['02 · 스쿼드·기록',['자동 편성 / 자리 눌러 배치','탭하여 선택 / 길게 눌러 이동','목록 / 다음으로 저장','교체 1쌍은 각 0.5쿼터']],
 ['03 · 결과·코멘트',['골 추가 펼치기 / 구간별 저장','실점 −/+ · 스코어 자동 합산','완료 버튼으로 확정','목록에서 구간 상세 펼치기']]
];
stages.forEach(([title,lines],i)=>{box(54+i*444,367,402,240,title,lines,{size:20});if(i<2)arrow(457+i*444,485,495+i*444,485);arrow(255+i*444,608,255+i*444,646)});
rect(54,649,1291,73,{fill:C.mint,stroke:'#c9dfd0'});text(699,681,'단계별 저장 → 경기 DB + 변경 이력 + 저장 영수증 → 목록에 작성 상태 표시',{size:24,weight:600,anchor:'middle'});text(699,707,'올해 기본 · 전체 기간 / 연월 범위 · 리그+대회 합산 · 자체전 포함 · 완료 후에도 수정 가능',{size:18,color:C.muted,anchor:'middle'});
box(54,756,625,116,'입력 보호 · 저장 영수증',['같은 탭 24시간 초안 · 동일 요청 중복 저장 방지','서버 저장은 단계별 버튼 · 충돌 시 덮어쓰기 차단'],{fill:C.sky,accent:C.blue,size:20});
box(714,756,631,116,'조회 메뉴 · 역할별 가이드',['홈 / 선수단 / 경기 / 선수 기록 / 대회 / 가이드',`운영진·회원별 앱 가이드 / 공유 PDF ${guideLabel}`],{size:20});
await end('02-match-workflow');

begin('03','개발 · 검증 · 배포 흐름도','GitHub는 소스와 검증 결과를 보관하고, 실제 서비스는 Northflank에서 실행됩니다.');
const roles=[['요구사항','사용자 · 실제 운영'],['기획','정의서 · 스토리보드'],['개발','화면 / API / DB'],['검증','개발자 + 총괄'],['사용자 확인','휴대전화 실사용']];
roles.forEach(([title,sub],i)=>{box(54+i*264,169,234,125,title,[sub],{fill:i===0?C.mint:C.paper,size:19});if(i<4)arrow(290+i*264,231,314+i*264,231)});
text(54,335,'요청에 맞춰 역할을 나누고, 기능 하나씩 구현·검증합니다.',{size:20,color:C.muted});
box(54,380,350,252,'① 로컬 개발',['하나의 Git 저장소','frontend/  React · TypeScript','backend/  기능별 Spring Boot','Flyway: V32 구간 실점','JUnit / 프론트 테스트'],{size:21});
box(525,380,350,252,'② GitHub + Actions',['ksmlucky/jochook-on','push / PR 때 자동 검증','Java 단위·API / 프론트 테스트','Testcontainers로 MySQL 검증','실행 JAR · 웹 빌드'],{fill:C.sky,accent:C.blue,size:21});
box(995,380,350,252,'③ Northflank 배포',['검증 커밋을 빌드·자동 적용','Dockerfile의 2개 target','api → Java 실행 이미지','web-northflank → Caddy + 웹','배포 후 HTTPS·권한·화면 확인'],{fill:C.mint,size:20});
arrow(405,485,523,485,'Git push');arrow(876,485,993,485,'검증 후 배포');
box(54,686,625,183,'운영 배포 확인',['이전 백업·격리 복원 검증 유지','웹a3bfd95 / API1519c9d·DB V32','공개 HTTPS·권한·자산 확인'],{size:21});
box(714,686,631,183,'이번 출시 범위',['홈 최근 경기 / 목록 구간 상세','선수 기록 축소 / 실점 버튼 정렬',`사용 가이드 ${guideLabel} · 앱과 공유 PDF 반영 확인`],{fill:C.mint,size:21});
await end('03-development-deployment');

begin('04','백업 · 복구 흐름도와 다음 과제','배포 전 백업·격리 복원과 V32 적용 후 기존 자료 보존을 확인했습니다. 자동 예약은 별도 과제입니다.');
box(54,173,350,239,'배포 직전 백업',['Northflank 비공개 MySQL','운영 자료 수동 백업','기존 테이블 원본 지문 확인','실제 자료·비밀값은 공개 제외'],{fill:C.mint,size:21});
box(525,173,350,239,'암호화된 로컬 사본',['백업 내용을 DPAPI로 암호화','Windows DPAPI · Git 제외','격리 복원 시험에 사용','현재 Windows 사용자에 종속'],{fill:C.sky,accent:C.blue,size:21});
box(995,173,350,239,'복원 · 자료 보존 확인',['별도 MySQL에 V31 복원','19개 테이블 복원·지문 대조','운영 V32 적용 후','기존 18개 업무 테이블 보존'],{size:21});
arrow(405,277,523,277,'보관');arrow(876,277,993,277,'해독·복원');
rect(54,461,1291,176,{fill:C.cream,stroke:'#e1c895'});
text(79,501,'매일 04시 · 7일 보관 → 무료 계정에서 거절',{size:27,weight:600,color:C.amber});
text(79,540,['일정 등록 API: daily 예약 불가(400) · 자동 일정 생성되지 않음','승인된 설정 권한 한 개를 잠깐 추가 → 오류 확인 → 즉시 회수 → 원래 권한과 일치 확인','무료 요금표의 백업 포함과 매일 자동 예약 허용은 다릅니다.'],{size:21,gap:32});
text(54,688,'출시 완료: 골별 기록과 기존 자료 보존 / 자동 백업은 후속 과제',{size:24,weight:600});
const next=[['후속 · 운영 자료 보호',['허용되는 무료 자동화 확인','별도 사본·키·정기 복원']],['출시 · 입력 안정성',['초안 복원 · 저장 영수증','모바일 편집 · 가이드 1.14']],['출시 · 선수 기록',['기간·대회·FK/PK 조회','골별 득점·도움 연결']],['출시 · 계정 보호',['본인 비밀번호 변경','관리자 확인 · 일회용 복구']]];
next.forEach(([title,lines],i)=>{box(54+i*330,721,300,151,title,lines,{size:20,fill:i===0?C.cream:C.paper,accent:i===0?C.amber:C.green});if(i<3)arrow(355+i*330,797,381+i*330,797)});
await end('04-backup-next-steps');

const items=[['01-system-architecture','시스템 구성'],['02-match-workflow','업무 흐름'],['03-development-deployment','개발·배포'],['04-backup-next-steps','백업·다음 과제']];
const svgs=await Promise.all(items.map(async([id],i)=>(await fs.readFile(path.join(out,id+'.svg'),'utf8'))
  .replaceAll('id="title"',`id="title-${i}"`).replaceAll('id="desc"',`id="desc-${i}"`)
  .replaceAll('aria-labelledby="title desc"',`aria-labelledby="title-${i} desc-${i}"`)
  .replaceAll('id="arrow"',`id="arrow-${i}"`).replaceAll('url(#arrow)',`url(#arrow-${i})`)));
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>조축ON 시스템 안내도</title><style>
*{box-sizing:border-box}body{margin:0;color:#203a33;background:#f7f8f4;font-family:'Malgun Gothic',sans-serif}header{padding:14px 22px;background:#fff;border-bottom:1px solid #d8e3dc;display:flex;gap:24px;align-items:center;flex-wrap:wrap}h1{font-size:18px;margin:0}nav{display:flex;gap:7px;flex-wrap:wrap}button,.download{font:inherit;font-size:14px;padding:10px 15px;border:1px solid #c8d8cf;border-radius:8px;background:white;color:#203a33;cursor:pointer;text-decoration:none}button[aria-selected=true]{background:#246b51;color:white;border-color:#246b51}button:focus-visible,a:focus-visible{outline:3px solid #d09b35;outline-offset:2px}main{max-width:1440px;margin:auto}section>svg{display:block;width:100%;height:auto}.downloads{display:flex;gap:10px;padding:12px 22px;flex-wrap:wrap}.note{padding:0 22px 20px;line-height:1.7;font-size:14px;color:#566d65}section[hidden]{display:none}@media(max-width:650px){section{overflow-x:auto}section>svg{min-width:1000px}.note{font-size:13px}}@media print{header,.downloads,.note{display:none}section[hidden]{display:block}section{break-after:page}section>svg{width:100%;min-width:0}@page{size:A4 landscape;margin:8mm}}
</style></head><body><header><h1>조축ON · 시스템 안내도</h1><nav role="tablist" aria-label="구성도 선택">${items.map(([id,title],i)=>`<button id="tab-${i}" role="tab" aria-controls="panel-${i}" aria-selected="${i===0}" type="button">${title}</button>`).join('')}</nav><button type="button" id="print">전체 인쇄 / PDF 저장</button></header><main>${svgs.map((s,i)=>`<section id="panel-${i}" role="tabpanel" aria-labelledby="tab-${i}"${i?' hidden':''}>${s}<div class="downloads"><a class="download" href="${items[i][0]}.svg" download>그림 원본 SVG 저장</a></div></section>`).join('')}</main><p class="note">${releaseLabel} · ${releaseStatus} · DB ${schemaLabel} · 가이드 ${guideLabel}.<br>휴대전화에서는 그림을 가로로 밀거나 SVG를 열어 확대할 수 있습니다. 배포 커밋·DB·공유 가이드의 운영 반영을 확인했습니다. 자동 백업은 무료 계정 제한으로 미설정이며, 구 API 단독 롤백은 새 기록을 보존하지 못할 수 있습니다. 근거는 docs/system-overview.md에 있습니다.</p><script>
const tabs=[...document.querySelectorAll('[role=tab]')], panels=[...document.querySelectorAll('[role=tabpanel]')];
tabs.forEach((tab,i)=>tab.addEventListener('click',()=>{tabs.forEach((t,j)=>{t.setAttribute('aria-selected',String(i===j));panels[j].hidden=i!==j});}));
document.getElementById('print').addEventListener('click',()=>window.print());
</script></body></html>`;
await fs.writeFile(path.join(out,'index.html'),html);
console.log(out);
