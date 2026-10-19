// Local feature illustration only: positions and roles, no private member data.
import fs from 'node:fs/promises'
const out = new URL('../docs/diagrams/internal-team-workflow.svg', import.meta.url)
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1190" viewBox="0 0 1240 1190" role="img" aria-labelledby="title desc"><title id="title">조축ON 자체전 팀 배정과 3백 배치</title><desc id="desc">3단계 통합 기능. 3-5-2는 CAM과 두 CM, 양쪽 윙백을 엇갈리게 배치하고 3-4-3은 LM과 RM을 사용한다. 01에서 A B를 정한 뒤 02에서 배치하고, 03에서 골·도움과 결과를 입력한다.</desc><rect width="1240" height="1190" fill="#f6f8f3"/><g font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif">'
const text = (x,y,s,size=19,color='#244438',anchor='start',weight=400) => { svg += `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}" font-weight="${weight}">${esc(s)}</text>` }
const box = (x,y,w,h,fill='#fff',stroke='#cdddcf',r=16) => { svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>` }
text(42,42,'JOCHOOK ON  /  조축ON',18,'#28654d','start',700)
text(1198,42,'2026.10.19 · 경기 입력 3단계',17,'#657a6f','end')
text(42,96,'팀을 먼저 나누고, 함께 정한 작전대로',34,'#244438','start',700)
text(42,135,'01의 A·B 배정을 02 스쿼드에 유지합니다. 03에서 골·도움을 기록합니다.',20,'#657a6f')
const shapes = [
 ['3-5-2', [['ST',34,12],['ST',66,12],['CAM',50,27],['LWB',10,38],['RWB',90,38],['CM',35,49],['CM',65,49],['LCB',23,69],['CB',50,75],['RCB',77,69],['GK',50,91]]],
 ['3-4-3', [['LW',20,14],['ST',50,10],['RW',80,14],['LM',10,43],['CM',36,43],['CM',64,43],['RM',90,43],['LCB',23,69],['CB',50,75],['RCB',77,69],['GK',50,91]]],
]
shapes.forEach(([label, positions], i) => {
 const x = 42+i*598, y=165, w=556
 box(x,y,w,610); text(x+24,y+44,label,30,'#28654d','start',700)
 const px=x+20, py=y+68, pw=w-40, ph=510
 box(px,py,pw,ph,'#e9f2e2','#b8cfb4',8)
 svg += `<path d="M ${px+8} ${py+ph/2} H ${px+pw-8}" stroke="#9ab595"/><circle cx="${px+pw/2}" cy="${py+ph/2}" r="54" fill="none" stroke="#9ab595"/><path d="M ${px+pw*.3} ${py} V ${py+50} H ${px+pw*.7} V ${py} M ${px+pw*.3} ${py+ph} V ${py+ph-50} H ${px+pw*.7} V ${py+ph}" fill="none" stroke="#9ab595"/>`
 positions.forEach(([pos,rx,ry]) => {
  const cx=px+pw*rx/100, cy=py+ph*ry/100
  const colors=pos==='GK'?['#fff3cd','#ddbd69','#865a04']:['ST','LW','RW'].includes(pos)?['#fff0f2','#e6a1b0','#a82e46']:['LCB','CB','RCB','LWB','RWB'].includes(pos)?['#eaf2ff','#aac1e7','#295d9c']:['#e4f4eb','#96c6a8','#236849']
  box(cx-33,cy-23,66,46,colors[0],colors[1],11); text(cx,cy+7,pos,19,colors[2],'middle',700)
 })
})
const steps=[['01 · 참석 명단','A / B팀을 고른 뒤 선수 체크','참석과 팀을 함께 지정'],['02 · 스쿼드·기록','팀별 후보와 자동 편성','드래그·직접 편집도 같은 팀'],['03 · 결과·코멘트','골·도움·스코어 입력','경기 완료 후 기본 집계']]
steps.forEach(([title,a,b],i)=>{
 const x=42+i*402; box(x,809,376,145,i===1?'#e5f1e8':'#fff')
 text(x+20,848,title,23,'#28654d','start',700); text(x+20,889,a,18); text(x+20,924,b,17,'#657a6f')
 if(i<2) text(x+389,888,'→',22,'#657a6f','middle')
})
box(42,984,1156,156,'#fff')
text(64,1022,'기존 자료를 이어 쓰는 방법',23,'#244438','start',700)
text(64,1057,'3-5-2 CDM → CAM  /  3-4-3 LWB·RWB → LM·RM  /  중앙 CB는 표시만 CB',18)
text(64,1089,'선수·득점·도움·교체는 유지합니다. 예전 계획의 팀이 모호하면 직접 배정합니다.',18,'#657a6f')
text(64,1120,'팀 변경으로 배치가 해제될 때 기록 손실이 있으면 차단합니다.',18,'#657a6f')
text(42,1171,'2026.10.19 경기 입력 통합 · V31 / 가이드 1.11 · 실제 회원 정보 없는 설명용 그림',15,'#657a6f')
svg+='</g></svg>'
await fs.mkdir(new URL('../docs/diagrams/', import.meta.url),{recursive:true})
await fs.writeFile(out,svg)
console.log('Generated docs/diagrams/internal-team-workflow.svg')
