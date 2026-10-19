import fs from 'node:fs/promises'
// Development workflow; no private team/member data or credentials.
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1110" viewBox="0 0 1200 1110" role="img" aria-labelledby="title desc"><title id="title">조축ON 대회 두 구간과 자체전 팀 선택</title><desc id="desc">외부 경기는 대회 연결과 관계없이 전반과 후반 30분씩 각 1쿼터로 기록할 수 있다. 자체전은 A B 팀을 먼저 선택하고 선수를 체크한다. 기존 기록은 보존한다.</desc><rect width="1200" height="1110" fill="#f5f8f3"/><g font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif">'
const text = (x,y,s,size=20,color='#244438',weight=400) => { svg += `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}">${escape(s)}</text>` }
const box = (x,y,w,h,fill='#fff') => { svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${fill}" stroke="#ceddce"/>` }
text(40,43,'JOCHOOK ON / 조축ON',19,'#28654d',700)
text(750,43,'2026.10.19 · 경기 입력 개선',18,'#657a6f')
text(40,100,'외부 경기는 형식 선택, 자체전은 팀 선택부터',36,'#244438',700)
text(40,141,'참석 → 스쿼드·기록 → 결과의 3단계로, 경기 형식에 맞게 작전판과 기록을 연결합니다.',21,'#657a6f')
box(40,174,1120,254)
text(64,216,'외부 경기: 대회 연결 없이도 전·후반 선택 가능',26,'#28654d',700)
box(64,244,510,151,'#eef5e9'); box(598,244,538,151,'#eef5e9')
text(89,281,'전반 · 1쿼터',25,'#28654d',700); text(89,319,'30분 / 전체 출전 = 1쿼터',23)
text(89,361,'같은 자리에서 교체하면 두 선수 각각 0.5',19,'#657a6f')
text(623,281,'후반 · 2쿼터',25,'#28654d',700); text(623,319,'30분 / 전체 출전 = 1쿼터',23)
text(623,361,'풀타임 합계 2쿼터 · 휴식 시간은 별도',19,'#657a6f')
const steps = [['01 · 참석 명단','선택하면 참석 반영'],['02 · 스쿼드·기록','배치·교체·골·도움'],['03 · 결과·코멘트','점검 후 기록 완료']]
steps.forEach(([a,b],i)=>{const x=40+i*378;box(x,455,364,115);text(x+18,497,a,22,'#28654d',700);text(x+18,538,b,19)})
box(40,598,1120,187)
text(64,639,'자체전 01 · A/B팀별 선수 체크',26,'#28654d',700)
text(64,680,'A팀 선택 → 선수 체크 → B팀 선택 → 선수 체크',24)
text(64,720,'체크로 참석과 팀을 지정합니다. 단계별 저장 버튼을 눌러야 DB에 저장됩니다.',20,'#657a6f')
text(64,755,'02에서 같은 팀 안에서 편성하고 기록합니다. 03에서 결과를 확인하고 완료합니다.',20,'#657a6f')
box(40,815,1120,232)
text(64,857,'기존 자료와 집계 기준',26,'#244438',700)
text(64,900,'기존 4쿼터 대회는 자동으로 줄이지 않습니다. 3·4쿼터 기록이 있으면 전환을 막습니다.',20)
text(64,940,'리그 + 대회 = 기록한 쿼터 수를 합산합니다. 분 단위 환산이나 90분 보정은 없습니다.',20)
text(64,980,'기본 4쿼터 일정은 시작 +2시간, 전·후반 일정은 시작 +60분으로 표시합니다.',20)
text(64,1019,'대회가 없으면 경기 작성 중 + 대회 등록 → 초안 유지 → 경기 저장으로 연결합니다.',19,'#657a6f')
text(40,1084,'2026.10.19 경기 입력 개선 · 가이드 1.8 · 배포 상태는 기능 문서 참조 · 실제 회원 정보 없음',17,'#657a6f')
svg += '</g></svg>'
await fs.writeFile(new URL('../docs/diagrams/tournament-halves.svg', import.meta.url), svg)
console.log('Generated docs/diagrams/tournament-halves.svg')
