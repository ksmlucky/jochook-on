import fs from 'node:fs/promises';
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="540" viewBox="0 0 1000 540">
<rect width="1000" height="540" fill="#f7f8f4"/><g font-family="Malgun Gothic,sans-serif" fill="#243c34">
<text x="40" y="52" font-size="28" font-weight="700">조축ON · 홈과 경기 목록에서 바로 펼쳐 보기</text>
<text x="40" y="87" font-size="17">2026-10-19 · 운영 확인 / 웹a3bfd95 / 가이드1.14 · 가상 예시</text>
<rect x="40" y="120" width="560" height="338" rx="20" fill="white" stroke="#cbd8ce"/>
<text x="62" y="158" font-size="17">2026-10-18 · 리그</text>
<text x="62" y="202" font-size="23" font-weight="700">예시 FC vs 상대 FC</text>
<rect x="442" y="178" width="132" height="32" rx="7" fill="#e6f4eb" stroke="#acd3ba"/><text x="456" y="200" font-size="17">✓ 기록 완료</text>
<text x="62" y="242" font-size="17">09:00–11:00 · 예시 구장</text><text x="494" y="244" font-size="27" font-weight="700">3 : 1</text>
<rect x="220" y="265" width="132" height="44" rx="9" fill="#f0f4ec" stroke="#d8e3dc"/><text x="236" y="293" font-size="17">기록 보기 ↗</text>
<rect x="360" y="265" width="214" height="44" rx="9" fill="#f0f4ec" stroke="#d8e3dc"/><text x="376" y="293" font-size="17">쿼터별 기록 펼치기 ▾</text>
<text x="62" y="353" font-size="18" font-weight="700">펼치면 구간별 기록</text><text x="62" y="389" font-size="17">1쿼터 · 예시선수 A 골 / 예시선수 B 도움</text><text x="62" y="422" font-size="17">실점 1골 · 실점이 있는 구간만 표시</text>
<text x="640" y="170" font-size="22" font-weight="700">결과 입력도 같은 높이로</text>
<text x="640" y="220" font-size="18">1쿼터 실점</text>
<rect x="640" y="240" width="60" height="44" rx="9" fill="white" stroke="#cbd8ce"/><text x="660" y="269" font-size="24">−</text>
<rect x="708" y="240" width="92" height="44" rx="9" fill="white" stroke="#cbd8ce"/><text x="748" y="269" font-size="22">1</text>
<rect x="808" y="240" width="60" height="44" rx="9" fill="white" stroke="#cbd8ce"/><text x="828" y="269" font-size="24">+</text>
<text x="640" y="332" font-size="17">탭 영역 높이 44px 유지</text><text x="640" y="366" font-size="17">실점 집계와 저장 규칙은 동일</text>
<text x="40" y="506" font-size="16">좁은 화면: 상태는 짧게, 긴 팀명은 줄바꿈 · 운영진/회원은 기존 팀 조회 권한 유지</text>
</g></svg>`;
await fs.writeFile(new URL('../docs/diagrams/compact-match-cards.svg',import.meta.url),svg);
