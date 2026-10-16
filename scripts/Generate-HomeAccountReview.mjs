import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const out = fileURLToPath(new URL('../docs/diagrams/home-account-followup/', import.meta.url))
await fs.mkdir(out, {recursive:true})
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
const svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="880" viewBox="0 0 1200 880" role="img" aria-labelledby="title"><title id="title">조축ON 홈과 계정 보호 후속 개선</title><rect width="1200" height="880" fill="#f5f7f3"/><g font-family="Malgun Gothic, sans-serif">']
const text = (x,y,s,size=20,color='#264b3d',weight=400) => svg.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(s)}</text>`)
const box = (x,y,w,h,color='#fff') => svg.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="${color}"/>`)
text(44,50,'JOCHOOK ON  /  RELEASE',17,'#567268',700)
text(44,102,'기록은 쉽게 찾고, 개인 계정은 안전하게',36,'#264b3d',700)
text(44,143,'2026.10.16 · 운영 d8b2763 / V30 · 실제 회원 정보 없는 설명용 그림',19,'#60766b')
const steps = [
 ['팀 접속','회원 코드 또는 개인 로그인'],
 ['우리 팀 홈','최근 경기 · 선수 기록 바로가기'],
 ['경기 기록 열기','운영진만 새 기록·이어서 작성'],
]
steps.forEach(([a,b],i)=>{const x=44+i*378;box(x,182,356,128,'#e5f0e8');text(x+20,224,a,25,'#24634c',700);text(x+20,267,b,18);if(i<2)text(x+359,254,'→',21)})
box(44,338,548,246)
text(68,380,'개인 계정 변경·복구',26,'#264b3d',700)
text(68,425,'현재 비밀번호 확인 또는 관리자 본인 확인',21)
text(68,465,'분실 시 30분 · 일회용 링크로 직접 설정',21)
text(68,506,'기존 로그인 종료 → 새 비밀번호로 접속',21,'#24634c',700)
text(68,548,'회원 공유 코드·팀 비밀번호는 그대로',18,'#60766b')
box(612,338,544,246,'#fff0da')
text(636,380,'자동 백업은 아직 미설정',26,'#875821',700)
text(636,425,'수동 사본과 자동 일정은 별개',21)
text(636,465,'점검 실패를 과거 성공처럼 남기던 문제 수정',19)
text(636,506,'다음: 무료 허용 주기 · 독립 사본 · 복원',20,'#875821',700)
text(636,548,'클라우드 자원·권한·요금 변경 없음',18,'#60766b')
box(44,612,1112,161)
text(68,653,'구현한 것과 결정이 필요한 것을 구분해요',24,'#264b3d',700)
text(68,695,'운영 반영   홈 · 비밀번호 변경/복구 · 모바일 기록·필터 개선 · V30 ERD',20)
text(68,735,'남은 과제   자동 백업 주기·독립 사본 · 서비스 관리자 계정의 별도 복구',20,'#875821')
text(44,821,'운영 d8b2763 / V30  |  역할별 사용 가이드 1.3와 함께 반영',19,'#60766b')
text(44,854,'이 그림의 원본은 scripts/Generate-HomeAccountReview.mjs 입니다.',16,'#60766b')
svg.push('</g></svg>')
await fs.writeFile(out+'overview.svg',svg.join(''))
await fs.writeFile(out+'index.html','<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>조축ON 후속 개선</title><style>body{margin:0;background:#f5f7f3;font-family:sans-serif}img{display:block;width:100%;max-width:1200px;margin:auto}p{padding:12px}a{color:#24634c}</style><p><a href="../../home-account-followup-2026-10-16.md">상세 문서</a> · <a href="overview.svg">원본 확대</a> · <a href="overview.png">PNG</a></p><img src="overview.svg" alt="새 홈, 본인 비밀번호 변경, 자동 백업의 남은 과제를 구분한 그림"></html>')
if(process.argv.includes('--png')) {const require=createRequire(import.meta.url);const sharp=require(process.env.JOCHOOK_DIAGRAM_SHARP||'sharp');await sharp(Buffer.from(svg.join(''))).png().toFile(out+'overview.png')}
console.log('Generated home/account production diagram (verified deployment).')
