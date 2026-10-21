import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMatchResultImage } from '../src/features/matches/matchResultImage.ts'

const player = (playerId, name, shirtNumber = playerId) => ({ playerId, name, shirtNumber, birthYear: 1996, vote: 'ATTENDING', attendance: 'PRESENT', playerType: 'MEMBER' })
const event = (scorerId, assistId = null, team = 'A') => ({ scorerId, assistId, team, type: 'NORMAL' })
const appearance = (playerId, goals, assists, team = 'A') => ({ playerId, goals, assists, team, slot: 'ST', entryOrder: 0 })
const fixture = () => ({
  teamName: '예시 FC',
  record: { id: 1, version: 1, kind: 'EXTERNAL', playedOn: '2026-10-25', kickoff: '09:00', opponent: '상대 FC', venue: '비공개 구장', scoreFor: 3, scoreAgainst: 1, recordingStage: 'COMPLETED',
    notes: '비공개 메모', participants: [player(1, '예시득점'), player(2, '예시도움'), player(3, '예시선수')], plannedLineup: [],
    quarters: [{ number: 1, goalEvents: [event(1, 2), event(1, 2)], goalsAgainst: 1, lineup: [appearance(1, 99, 99)] },
      { number: 2, goalEvents: null, goalsAgainst: 0, lineup: [appearance(1, 1, 0), appearance(2, 0, 1)] }] }
})

test('events override lineup while legacy quarters add to the same player; no private data or mutation', () => {
  const input = fixture(), before = structuredClone(input)
  const result = buildMatchResultImage(input)
  assert.match(result.svg, /3 : 1/)
  assert.match(result.svg, /3골/)
  assert.match(result.svg, /3도움/)
  assert.equal((result.svg.match(/#1 예시득점/g) ?? []).length, 3)
  assert.ok(!result.svg.includes('99골'))
  for (const privateText of ['비공개 구장', '비공개 메모', '1996', 'playerId']) assert.ok(!result.svg.includes(privateText))
  assert.ok(!result.svg.includes('합계가 달라요'))
  assert.deepEqual(input, before)
  assert.equal(result.filename, 'jochook-on-result-2026-10-25.png')
})

test('empty event array is authoritative and planned participants never become scorers', () => {
  const input = fixture()
  input.record.scoreFor = 0
  input.record.scoreAgainst = 0
  input.record.quarters = [{ number: 1, goalEvents: [], goalsAgainst: 0, lineup: [appearance(1, 7, 8)] }]
  input.record.plannedLineup = [{ playerId: 3, team: 'A', quarterNumber: 1, slot: 'ST', entryOrder: 0 }]
  const { svg } = buildMatchResultImage(input)
  assert.match(svg, /0 : 0/)
  assert.match(svg, /득점 기록 없음/)
  assert.match(svg, /도움 기록 없음/)
  assert.ok(!svg.includes('예시선수'))
  assert.ok(!svg.includes('예시득점'))
})

test('internal teams keep separate totals for the same player across quarters', () => {
  const input = fixture()
  input.record.kind = 'INTERNAL'
  input.record.scoreFor = 1
  input.record.scoreAgainst = 2
  input.record.quarters = [{ number: 1, goalEvents: [event(1, 2, 'A'), event(1, 2, 'B'), event(1, null, 'B')], lineup: [] }]
  const { svg } = buildMatchResultImage(input)
  assert.match(svg, /A팀 기록/)
  assert.match(svg, /B팀 기록/)
  assert.match(svg, /data-metric="goals" data-team="A">.*1골/s)
  assert.match(svg, /data-metric="goals" data-team="B">.*2골/s)
  assert.equal((svg.match(/#1 예시득점/g) ?? []).length, 5)
  assert.ok(!svg.includes('상대 FC'))
})

test('missing scores and stage are distinct from zero and completed', () => {
  const input = fixture()
  input.record.scoreFor = null
  input.record.scoreAgainst = null
  input.record.recordingStage = 'RESULT'
  const { svg } = buildMatchResultImage(input)
  assert.match(svg, /— : —/)
  assert.match(svg, /스코어 미입력/)
  assert.match(svg, /작성 중/)
  input.record.recordingStage = null
  assert.match(buildMatchResultImage(input).svg, /기존 기록 · 상태 미지정/)
})

test('home score discrepancy is shown even if conceded periods are incomplete', () => {
  const input = fixture()
  input.record.scoreFor = 5
  input.record.quarters[0].goalsAgainst = null
  const { svg } = buildMatchResultImage(input)
  assert.match(svg, /5 : 1/)
  assert.match(svg, /우리 팀 스코어와 선수 득점 합계가 달라요/)
  assert.ok(!svg.includes('최종 실점과'))
  input.record.quarters[0].goalsAgainst = 4
  assert.match(buildMatchResultImage(input).svg, /최종 실점과 구간별 실점 합계가 달라요/)
})

test('SVG escapes names, handles missing players and never embeds external resources', () => {
  const input = fixture()
  input.teamName = '<script>&"팀"'
  input.record.opponent = '<image href="https://x">'
  input.record.participants[0].name = '<script>&'
  input.record.tournamentId = 99
  input.record.tournamentName = '봄 <대회>'
  input.record.quarters[0].goalEvents.push(event(98765))
  const { svg } = buildMatchResultImage(input)
  assert.match(svg, /&lt;script&gt;/)
  assert.match(svg, /&amp;/)
  assert.match(svg, /봄 &lt;대회&gt;/)
  assert.match(svg, /선수 미확인/)
  for (const tag of ['<script>', '<image ', 'foreignObject', '98765']) assert.ok(!svg.includes(tag))
})

test('long and numerous scorer lists are explicitly shortened and image height stays bounded', () => {
  const input = fixture()
  input.record.kind = 'INTERNAL'
  input.record.participants = Array.from({ length: 60 }, (_, i) => player(i, '아주긴선수이름'.repeat(6) + i))
  input.record.quarters = [{ number: 1, lineup: [], goalEvents: input.record.participants.flatMap(p => [event(p.playerId, (p.playerId + 1) % 60, 'A'), event(p.playerId, (p.playerId + 1) % 60, 'B')]) }]
  const { svg, width, height: resultHeight } = buildMatchResultImage(input)
  assert.match(svg, /외 44명/)
  assert.match(svg, /긴 이름은 …로 줄였어요/)
  assert.equal((svg.match(/data-metric=/g) ?? []).length, 64)
  const height = Number(svg.match(/<svg[^>]+height="(\d+)"/)[1])
  assert.ok(height <= 4096, `height=${height}`)
  assert.equal(resultHeight, height)
  assert.equal(width, 1080)
  assert.match(svg, /width="1080"/)
  const shownGoals = (svg.match(/data-goal-link=/g) ?? []).length
  assert.ok(shownGoals > 0 && shownGoals <= 16)
  assert.ok(svg.includes(`외 ${120 - shownGoals}골`))
})

test('each goal preserves its own assist and type, with half labels and no inferred legacy links', () => {
  const input = fixture()
  input.record.matchFormat = 'TWO_HALVES_30'
  input.record.quarters[0].goalEvents = [event(1, 2), { ...event(1, 3), type: 'FREE_KICK' }, event(1)]
  const { svg } = buildMatchResultImage(input)
  const links = [...svg.matchAll(/<g data-goal-link="true"[^>]*>(.*?)<\/g>/gs)].map(m => m[1])
  assert.equal(links.length, 3)
  assert.match(links[0], /#1 예시득점.*#2 예시도움/s)
  assert.ok(!links[0].includes('#3 예시선수'))
  assert.match(links[1], /#1 예시득점.*프리킥.*#3 예시선수/s)
  assert.match(links[2], /#1 예시득점.*도움 없음/s)
  assert.match(svg, /전반\(1쿼터\) · 골별 기록/)
  assert.match(svg, /후반\(2쿼터\) · 골·도움 연결 미기록/)
})

test('empty events create no links; unknown assister stays unknown and quarter sequence is sorted', () => {
  const input = fixture()
  input.record.quarters = [{ number: 4, lineup: [], goalEvents: [event(1, 9876)] }, { number: 2, lineup: [], goalEvents: [event(2, 1)] }, { number: 1, goalEvents: [], lineup: [appearance(1, 7, 8)] }]
  const { svg } = buildMatchResultImage(input)
  assert.equal((svg.match(/data-goal-link=/g) ?? []).length, 2)
  assert.ok(svg.indexOf('2쿼터 · 골별 기록') < svg.indexOf('4쿼터 · 골별 기록'))
  assert.match(svg, /선수 미확인/)
  assert.ok(!svg.includes('연결 미기록'))
})
