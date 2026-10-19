import { mkdir, writeFile } from 'node:fs/promises'
const out = new URL('../docs/diagrams/unified-match/', import.meta.url)
await mkdir(out, { recursive: true })
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
const steps = [
  ['01', '참석 명단', ['투표한 선수를 체크', '선택하면 참석으로 반영', '자체전은 A·B팀 먼저 지정']],
  ['02', '스쿼드·개인 기록', ['자동 편성 또는 직접 배치', '같은 작전판에서 교체·골·도움', '한눈에 보기에서도 바로 수정']],
  ['03', '결과·코멘트', ['최종 스코어와 코멘트 입력', '개인 기록 합계 확인', '경기 완료 → 기본 시즌 집계']],
]
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="620" viewBox="0 0 1120 620" role="img" aria-labelledby="title desc"><title id="title">조축ON 통합 경기 입력 흐름</title><desc id="desc">3단계 통합. 참석 명단, 스쿼드와 개인 기록, 결과의 세 단계. 중간 저장은 작성 중 상태이고 경기 완료를 눌러 기본 시즌 집계에 포함한다.</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#286754"/></marker></defs><rect width="1120" height="620" fill="#f5f7f1"/><g font-family="Malgun Gothic,Arial,sans-serif" fill="#203d34"><text x="40" y="49" font-size="15" fill="#64756c">조축ON · 2026-10-19 · 3단계 통합 · 배포 상태는 기능 문서 참조</text><text x="40" y="96" font-size="31" font-weight="700">배치는 한 번, 기록은 같은 작전판에서</text><text x="40" y="132" font-size="18">계획 복사와 실제 참석 재확인 없이 3단계로 입력해요.</text>`
steps.forEach(([n, title, lines], i) => {
  const x = 40 + i * 362
  svg += `<rect x="${x}" y="174" width="316" height="232" rx="18" fill="white" stroke="#cbd9cf"/><rect x="${x + 20}" y="194" width="48" height="36" rx="10" fill="#286754"/><text x="${x + 44}" y="219" text-anchor="middle" fill="white" font-size="18">${n}</text><text x="${x + 20}" y="270" font-size="24" font-weight="700">${escape(title)}</text>`
  lines.forEach((line,j) => { svg += `<text x="${x+20}" y="${307+j*31}" font-size="16">${escape(line)}</text>` })
  if(i<2)svg+=`<path d="M${x+322} 288h32" fill="none" stroke="#286754" stroke-width="3" marker-end="url(#arrow)"/>`
})
svg += `<rect x="40" y="438" width="1040" height="136" rx="18" fill="#e8efe7"/><text x="65" y="477" font-size="20" font-weight="700">중간 저장 후 언제든 이어서 작성</text><text x="65" y="510" font-size="17">경기 전에는 스쿼드만 저장 → 경기 후 같은 화면에서 골·도움 추가 → 경기 완료</text><text x="65" y="545" font-size="15">선수 이동 시 기록도 함께 이동 · 교체는 각각 0.5쿼터 · 득점 있는 선수의 배치 삭제는 차단</text></g></svg>`
await writeFile(new URL('workflow.svg', out), svg)
await writeFile(new URL('workflow.mmd', out), `flowchart LR
  A[01 참석 명단 체크 / 자체전 A·B팀] --> B[02 스쿼드·개인 기록]
  B --> C[03 결과·코멘트]
  A --> S[중간 저장 / 작성 중]
  B --> S
  C --> S
  S --> B
  C --> D[경기 완료]
  D --> E[기본 시즌 통계 포함]
`)
await writeFile(new URL('index.html', out), `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>조축ON · 경기 입력 3단계</title><style>body{margin:24px;background:#f5f7f1;font-family:system-ui,sans-serif;color:#203d34}img{width:100%;max-width:1120px}a{color:#286754}</style><h1>경기 입력 3단계</h1><p>2026-10-19 3단계 통합. 운영 앱과 운영용 사용자 가이드는 아직 4단계입니다.</p><img src="workflow.svg" alt="참석 명단 → 스쿼드·개인 기록 → 결과·코멘트. 중간 저장 후 이어 쓰고 경기 완료로 집계합니다."><p><a href="../../unified-match-entry-2026-10-19.md">요구사항·호환성·검증</a></p></html>`)
console.log('Unified match workflow SVG, Mermaid and HTML generated.')
