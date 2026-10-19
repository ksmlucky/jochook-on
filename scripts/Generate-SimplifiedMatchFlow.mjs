import fs from 'node:fs/promises';
const boxes=[['01 참석 명단',['참석 선수 선택','자체전 A·B팀 구분']],['02 스쿼드 배치',['자리 → 이름순 목록 → 즉시 배치','선발이 있을 때만 + 교체','골 입력·경기 엑셀 제거']],['03 결과·코멘트',['쿼터/전후반 → 골·도움 연결','구간별 저장 후 같은 화면 유지','스코어·코멘트 → 경기 완료']]];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="500" viewBox="0 0 1200 500"><rect width="1200" height="500" fill="#f7f8f4"/><g font-family="Malgun Gothic,sans-serif" fill="#243c34"><text x="36" y="48" font-size="28" font-weight="700">조축ON · 배치는 02, 골 기록은 03</text><text x="36" y="80" font-size="16">2026-10-19 로컬 개발판 · 미배포 / DB 변경 없음</text>';
boxes.forEach(([title,lines],i)=>{let x=36+i*390;svg+=`<rect x="${x}" y="120" width="350" height="225" rx="18" fill="white" stroke="#cad9cd"/><text x="${x+20}" y="165" font-size="23" font-weight="700">${title}</text>`;lines.forEach((line,j)=>svg+=`<text x="${x+20}" y="210" dy="${j*38}" font-size="17">${esc(line)}</text>`);if(i<2)svg+=`<text x="${x+358}" y="233" font-size="28">→</text>`});
svg+='<text x="36" y="402" font-size="20">오른쪽 아래: 목록 / 다음 → 마지막 단계: 목록 / 완료</text><text x="36" y="442" font-size="17">구간별 저장은 현재 경기의 다른 변경도 함께 저장합니다. 완료 전에는 작성 중으로 보관합니다.</text></g></svg>';
await fs.writeFile(new URL('../docs/diagrams/match-entry-simplified.svg',import.meta.url),svg);
