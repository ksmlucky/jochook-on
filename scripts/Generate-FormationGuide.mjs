// Source-controlled technical illustration; synthetic positions, no member data.
import fs from 'node:fs/promises'
const out = new URL('../docs/diagrams/formation-guide.svg', import.meta.url)
const configs = [
  ['4-1-2-3', ['기존 구성', '측면 공격수와 중앙 3명'], [['LW','ST','RW'],['LCM','RCM'],['CDM'],['LB','LCB','RCB','RB'],['GK']]],
  ['4-4-2', ['두 줄과 두 톱', '역할을 단순하게 나누기'], [['LST','RST'],['LM','LCM','RCM','RM'],['LB','LCB','RCB','RB'],['GK']]],
  ['4-2-3-1', ['두 명이 중앙을 받치고', 'CAM이 공격을 연결'], [['ST'],['LM','CAM','RM'],['LCDM','RCDM'],['LB','LCB','RCB','RB'],['GK']]],
  ['4-1-4-1', ['중원 4명과 CDM', '중앙 숫자를 유지하기'], [['ST'],['LM','LCM','RCM','RM'],['CDM'],['LB','LCB','RCB','RB'],['GK']]],
]
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000" viewBox="0 0 1400 1000" role="img" aria-labelledby="title desc"><title id="title">조축ON 포메이션 4종</title><desc id="desc">로컬 확장판의 4-1-2-3, 4-4-2, 4-2-3-1, 4-1-4-1 자리 배치와 시즌 집계 흐름. 운영 서버에는 미반영.</desc><rect width="1400" height="1000" fill="#f7f8f4"/><g font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif">`
const text = (x,y,value,size=20,fill='#243c34',anchor='start',weight=400) => { svg += `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}">${esc(value)}</text>` }
const rect = (x,y,w,h,fill,stroke='#d9e3dc',r=14) => { svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>` }
text(50,47,'JOCHOOK ON  /  조축ON',19,'#28654d','start',700)
text(1350,47,'로컬 구현 · 운영 미반영 · 2026.10.15',18,'#6a756e','end')
text(50,103,'우리 팀에 맞는 4백, 네 가지부터',36,'#243c34','start',700)
text(50,142,'경기별로 1~4쿼터에 공통 적용 · 자체전 A/B는 독립 선택 · 실제 출전 기록이 있으면 변경 보호',20,'#5d7168')
configs.forEach(([label, notes, rows], index) => {
  const x=50+index*330
  rect(x,180,310,580,'#ffffff')
  text(x+20,223,label,30,'#28654d','start',700)
  notes.forEach((note,i)=>text(x+20,257+i*27,note,18,'#5d7168'))
  rect(x+16,311,278,424,'#eaf2e9','#bdd0bc',6)
  svg+=`<path d="M ${x+23} 523 H ${x+287}" stroke="#bbcfb9" fill="none"/><circle cx="${x+155}" cy="523" r="40" fill="none" stroke="#bbcfb9"/><path d="M ${x+96} 311 V 359 H ${x+214} V 311 M ${x+96} 735 V 686 H ${x+214} V 735" fill="none" stroke="#bbcfb9"/>`
  text(x+155,334,'공격 방향 ↑',12,'#7a8d79','middle')
  rows.forEach((row, ri) => row.forEach((slot, si) => {
    const px=x+155+(si-(row.length-1)/2)*65, py=376+ri*(320/(rows.length-1))
    const group=slot==='GK'?'GK':['LB','LCB','RCB','RB'].includes(slot)?'DF':['LW','RW','ST','LST','RST'].includes(slot)?'FW':'MF'
    const [fill,stroke,color]={GK:['#fff3cd','#e3bb63','#8b5b00'],DF:['#eaf2ff','#9ebcea','#285b9d'],MF:['#e6f5ec','#98c9ac','#226748'],FW:['#fff0f2','#e8a8b2','#b52e45']}[group]
    rect(px-28,py-22,56,44,fill,stroke,10)
    text(px,py+6,slot,slot.length===4?14:16,color,'middle',700)
  }))
})
text(50,808,'선호 100 / 60 / 30 · LM↔LW, RM↔RW, CAM↔CM은 보조 점수 · GK·출석·휴식·교체 규칙 유지',19,'#5d7168')
const flow=[['포메이션 선택','외부 경기 자동 편성'],['02 계획 저장','자동·수동 계획 저장'],['03 실제 기록','1:1 교체는 각 0.5Q'],['선수 시즌 기록','완료·외부 경기 기본']]
flow.forEach(([title,desc],i)=>{
  rect(50+i*330,840,310,100,i===3?'#e8f3eb':'#fff')
  text(70+i*330,878,title,22,'#28654d','start',700); text(70+i*330,913,desc,18,'#5d7168')
  if(i<3) text(370+i*330,897,'→',20,'#81968a','middle')
})
text(50,976,'자체전 자동 팀 분배 · 3백/윙백 · 쿼터별 포메이션 변경 · 연말 시상 정책은 이후 단계',17,'#6a756e')
svg+='</g></svg>'
await fs.mkdir(new URL('../docs/diagrams/', import.meta.url),{recursive:true})
await fs.writeFile(out,svg)
console.log(out.pathname)
