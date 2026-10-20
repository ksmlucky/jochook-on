import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildMatchResultImage } from '../frontend/src/features/matches/matchResultImage.ts'

const state = '배포 후보 · 2026-10-20'
const out = new URL('../docs/diagrams/result-sharing/', import.meta.url)
await fs.mkdir(out, { recursive: true })
const record = {
  id: 1, version: 0, kind: 'EXTERNAL', matchFormat: 'FOUR_QUARTERS',
  playedOn: '2026-10-25', kickoff: '09:00', venue: '', opponent: '상대 FC',
  scoreFor: 3, scoreAgainst: 1, recordingStage: 'COMPLETED',
  tournamentName: null, notes: '', plannedLineup: [],
  participants: ['가상민수', '가상지훈', '가상현우'].map((name, i) => ({
    playerId: i + 1, name, shirtNumber: [9, 7, 11][i], playerType: 'MEMBER',
    birthYear: null, attendance: 'PRESENT', vote: 'ATTENDING',
  })),
  quarters: [{number: 1, lineup: [], goalsAgainst: 1, goalEvents: [
    {scorerId: 1, assistId: 2, type: 'NORMAL', team: 'A'},
    {scorerId: 1, assistId: 3, type: 'NORMAL', team: 'A'},
    {scorerId: 2, assistId: null, type: 'FREE_KICK', team: 'A'},
  ]}],
}
const examples = [
  ['external', { record, teamName: '예시 FC' }],
  ['internal', { record: { ...record, kind: 'INTERNAL', scoreAgainst: 2, quarters: [{...record.quarters[0], goalEvents: [...record.quarters[0].goalEvents, {scorerId: 3, assistId: null, type: 'NORMAL', team: 'B'}, {scorerId: 3, assistId: null, type: 'NORMAL', team: 'B'}]}]}, teamName: '예시 FC' }],
  ['draft', { record: { ...record, scoreFor: null, scoreAgainst: null, recordingStage: 'PLAN', quarters: [] }, teamName: '예시 FC' }],
]
const sharp = createRequire(import.meta.url)(process.env.JOCHOOK_SHARP_MODULE || 'sharp')
for (const [name, input] of examples) {
  const result = buildMatchResultImage(input)
  await fs.writeFile(new URL(`${name}.svg`, out), result.svg)
  await sharp(Buffer.from(result.svg)).png().toFile(fileURLToPath(new URL(`${name}.png`, out)))
}
await fs.writeFile(new URL('index.html',out),`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>경기 결과 이미지 공유</title><style>body{margin:24px;background:#f5f7f2;color:#233d34;font:16px/1.7 system-ui}main{max-width:1100px;margin:auto}.flow{padding:18px;background:#e4eddf;border-radius:14px}.examples{display:flex;gap:20px;align-items:start;flex-wrap:wrap}figure{margin:0;flex:1 1 280px}img{width:100%;height:auto}a{color:#28634e}</style><main><h1>경기 결과 이미지 공유</h1><p>${state} · 모든 팀·선수·기록은 가상 예시입니다.</p><p class="flow">경기 결과 → 결과 이미지 → 저장된 결과 미리보기 → 이미지 공유 / PNG 다운로드</p><p>회원·운영진 모두 조회 중인 경기에서 사용할 수 있습니다. 미입력은 —, 작성 중은 별도 표시합니다. 앱은 자동 전송하지 않습니다.</p><div class="examples">${examples.map(([name],i)=>`<figure><h2>${['외부 경기','자체전 A/B','미입력·작성 중'][i]}</h2><img src="${name}.svg" alt="${['외부 경기 3대1 득점과 도움','자체전 3대2 A B팀별 기록','작성 중 점수 미입력'][i]}"><figcaption><a href="${name}.png">PNG</a> · <a href="${name}.svg">SVG 원본</a></figcaption></figure>`).join('')}</div><p><a href="../../match-result-sharing.md">기능 명세와 검증 결과</a></p></main></html>`)
console.log('Generated fictional result share examples (SVG/PNG/HTML).')
