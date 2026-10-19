import fs from 'node:fs/promises';
const out=new URL('../docs/diagrams/match-result-disclosures.svg',import.meta.url);
const panels=[['02 선수 해제',['X 또는 선발·교체 해제','골·도움 있으면 변경 차단','4초 안내 후 페이드아웃']],['03 결과 입력',['골 추가를 펼쳐 입력','실점 숫자 입력 / − +','최종 스코어 자동 합산']],['경기 목록',['기존 득점 요약 유지','쿼터별 기록 펼치기','골·도움 연결 / 양수 실점']]];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="450" viewBox="0 0 1200 450"><rect width="1200" height="450" fill="#f7f8f4"/><g font-family="Malgun Gothic,sans-serif" fill="#243c34"><text x="36" y="48" font-size="28" font-weight="700">조축ON · 입력은 간결하게, 기록은 펼쳐서</text><text x="36" y="80" font-size="16">2026-10-19 · 가이드 1.13 · 운영 반영 여부는 배포 문서 참조</text>';
panels.forEach(([title,lines],i)=>{const x=36+i*390;svg+=`<rect x="${x}" y="120" width="350" height="210" rx="18" fill="white" stroke="#cad9cd"/><text x="${x+20}" y="163" font-size="23" font-weight="700">${title}</text>`;lines.forEach((line,j)=>svg+=`<text x="${x+20}" y="210" dy="${j*35}" font-size="18">${esc(line)}</text>`);});
svg+='<text x="36" y="385" font-size="17">전·후반 / 4쿼터 · 자체전 A/B 구분 · 예전 합계는 골과 도움을 임의로 연결하지 않아요.</text></g></svg>';
await fs.writeFile(out,svg);
