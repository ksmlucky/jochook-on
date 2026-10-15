// Source-controlled technical illustration; synthetic positions, no member data.
import fs from 'node:fs/promises'
const out = new URL('../docs/diagrams/formation-guide.svg', import.meta.url)
const releaseLabel = '2026.10.15 대회·기록 확장판 · 운영 배포 확인'
const configs = [
  ['4-1-2-3', ['기존 구성', '측면 공격수와 중앙 3명'], [['LW','ST','RW'],['LCM','RCM'],['CDM'],['LB','LCB','RCB','RB'],['GK']]],
  ['4-4-2', ['두 줄과 두 톱', '역할을 단순하게 나누기'], [['LST','RST'],['LM','LCM','RCM','RM'],['LB','LCB','RCB','RB'],['GK']]],
  ['4-2-3-1', ['두 명이 중앙을 받치고', 'CAM이 공격을 연결'], [['ST'],['LM','CAM','RM'],['LCDM','RCDM'],['LB','LCB','RCB','RB'],['GK']]],
  ['4-1-4-1', ['중원 4명과 CDM', '중앙 숫자를 유지하기'], [['ST'],['LM','LCM','RCM','RM'],['CDM'],['LB','LCB','RCB','RB'],['GK']]],
  ['3-5-2', ['두 ST · CAM · 두 CM', '양쪽 윙백은 CM보다 위에 배치'], [['LST','RST'],['CAM'],['LWB','LCM','RCM','RWB'],['LCB','CCB','RCB'],['GK']]],
  ['3-4-3', ['중앙 수비 3명과 공격 3명', 'LM·RM이 양쪽 측면을 담당'], [['LW','ST','RW'],['LM','LCM','RCM','RM'],['LCB','CCB','RCB'],['GK']]],
]
for (const [label, , rows] of configs) {
  const slots = rows.flat()
  if (slots.length !== 11 || new Set(slots).size !== 11 || slots.filter(slot => slot === 'GK').length !== 1) throw new Error(`Invalid formation: ${label}`)
}
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1640" viewBox="0 0 1400 1640" role="img" aria-labelledby="title desc"><title id="title">조축ON 포메이션 6종</title><desc id="desc">${releaseLabel}. 4-1-2-3, 4-4-2, 4-2-3-1, 4-1-4-1, 3-5-2, 3-4-3 자리 배치. 3-5-2는 CAM, 3-4-3은 LM과 RM을 사용한다. 대회는 두 구간, 자체전은 4쿼터이며 A B팀을 먼저 고른다. V28과 가이드 1.2 배포 확인.</desc><rect width="1400" height="1640" fill="#f7f8f4"/><g font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif">`
const text = (x,y,value,size=20,fill='#243c34',anchor='start',weight=400) => { svg += `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}">${esc(value)}</text>` }
const rect = (x,y,w,h,fill,stroke='#d9e3dc',r=14) => { svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>` }
text(50,47,'JOCHOOK ON  /  조축ON',19,'#28654d','start',700)
text(1350,47,releaseLabel,18,'#6a756e','end')
text(50,103,'4백과 3백, 여섯 가지 포메이션 비교',36,'#243c34','start',700)
text(50,142,'대회 전·후반 / 기본 4쿼터에 공통 적용 · 자체전 A/B는 독립 선택 · 실제 기록이 있으면 변경 보호',20,'#5d7168')
configs.forEach(([label, notes, rows], index) => {
  const x=50+(index%3)*440, y=Math.floor(index/3)*610, cx=x+210
  rect(x,180+y,420,580,'#ffffff')
  text(x+20,223+y,label,30,'#28654d','start',700)
  notes.forEach((note,i)=>text(x+20,257+y+i*27,note,18,'#5d7168'))
  rect(x+16,311+y,388,424,'#eaf2e9','#bdd0bc',6)
  svg+=`<path d="M ${x+23} ${523+y} H ${x+397}" stroke="#bbcfb9" fill="none"/><circle cx="${cx}" cy="${523+y}" r="40" fill="none" stroke="#bbcfb9"/><path d="M ${cx-60} ${311+y} V ${359+y} H ${cx+60} V ${311+y} M ${cx-60} ${735+y} V ${686+y} H ${cx+60} V ${735+y}" fill="none" stroke="#bbcfb9"/>`
  text(cx,334+y,'공격 방향 ↑',12,'#7a8d79','middle')
  rows.forEach((row, ri) => row.forEach((slot, si) => {
    const px=cx+(si-(row.length-1)/2)*(row.length===5?70:85), py=376+y+ri*(320/(rows.length-1))+(label==='3-5-2'&&['LWB','RWB'].includes(slot)?-30:slot==='CCB'?12:0)
    const group=slot==='GK'?'GK':['LB','LCB','CCB','RCB','RB','LWB','RWB'].includes(slot)?'DF':['LW','RW','ST','LST','RST'].includes(slot)?'FW':'MF'
    const [fill,stroke,color]={GK:['#fff3cd','#e3bb63','#8b5b00'],DF:['#eaf2ff','#9ebcea','#285b9d'],MF:['#e6f5ec','#98c9ac','#226748'],FW:['#fff0f2','#e8a8b2','#b52e45']}[group]
    rect(px-28,py-22,56,44,fill,stroke,10)
    text(px,py+6,slot,slot.length===4?14:16,color,'middle',700)
  }))
})
text(50,1410,'선호 100 / 60 / 30 · 인접 역할은 20 / 12 / 6 · GK·출석·휴식·교체 규칙 유지',19,'#5d7168')
text(50,1438,'CCB = 중앙 CB · LWB/RWB = 윙백 (수비 색상) · 측면 풀백·미드필더도 낮은 가중치로 윙백 배치 가능',18,'#5d7168')
const flow=[['01 참석·팀 선택','자체전 A/B 먼저 체크'],['02 계획 저장','전체보기에서 배치 수정'],['03 실제 기록','골·도움·FK/PK 수정'],['선수 기록 메뉴','기간·리그·대회별 조회']]
flow.forEach(([title,desc],i)=>{
  rect(50+i*330,1460,310,100,i===3?'#e8f3eb':'#fff')
  text(70+i*330,1498,title,22,'#28654d','start',700); text(70+i*330,1533,desc,18,'#5d7168')
  if(i<3) text(370+i*330,1517,'→',20,'#81968a','middle')
})
text(50,1598,'V28 · 가이드 1.2 배포 확인 / 저장 영수증으로 재시도 보호 · 실제 쿼터 수로 합산, 시간 환산 없음',17,'#6a756e')
text(50,1626,'자체전 자동 팀 분배 · 쿼터별 포메이션 변경 · 연말 시상 정책은 이후 단계',16,'#6a756e')
svg+='</g></svg>'
await fs.mkdir(new URL('../docs/diagrams/', import.meta.url),{recursive:true})
await fs.writeFile(out,svg)
console.log(out.pathname)
