import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSquadImage, canShareSquadFile, squadImagePositions } from '../src/features/matches/squadImage.ts'
import { formationOptions } from '../src/features/matches/formations.ts'

const p = (playerId, name, shirtNumber) => ({ playerId, name, shirtNumber, birthYear: 1996, playerType: 'MEMBER', attendance: 'PRESENT', vote: 'ATTENDING' })
const entry = (playerId, team = 'A', quarterNumber = 1, entryOrder = 0) => ({ playerId, team, quarterNumber, entryOrder, slot: 'ST' })
const fixture = () => ({ teamName: '예시 FC', playedOn: '2026-10-25', kickoff: '09:00', opponent: '상대 FC', internal: true, unsaved: true, quarter: 1, team: 'A', formationA: 'F4123', formationB: 'F343', entries: [entry(1), entry(2, 'A', 1, 1), entry(3, 'B'), entry(4, 'A', 2)], participants: [p(1, '예시선발', 9), p(2, '예시교체', 19), p(3, '다른팀선수', 39), p(4, '다른쿼터선수', 49)] })

test('unsupported or blocked file sharing falls back without opening the native share sheet', () => {
  const file = new File(['PNG'], 'squad.png', { type: 'image/png' })
  assert.equal(canShareSquadFile(file, {}), false)
  assert.equal(canShareSquadFile(file, { share() { throw new Error('must not call') }, canShare() { throw new Error('blocked') } }), false)
  assert.equal(canShareSquadFile(file, { share() { throw new Error('must not call') }, canShare({ files }) { return files[0] === file } }), true)
})

test('export includes only selected team/period with substitute, shirt numbers and draft marker', () => {
  const input = fixture(), before = structuredClone(input)
  const { svg, filename } = buildSquadImage(input)
  for (const value of ['예시선발', '예시교체', '#9', '#19', 'A팀', '저장 전', '미배치']) assert.ok(svg.includes(value), value)
  for (const value of ['다른팀선수', '다른쿼터선수', '1996', 'playerId']) assert.ok(!svg.includes(value), value)
  assert.equal(filename, 'jochook-on-2026-10-25-1Q-A.png')
  assert.deepEqual(input, before)
  const other = buildSquadImage({ ...input, team: 'B', unsaved: false })
  assert.ok(other.svg.includes('다른팀선수'))
  assert.ok(!other.svg.includes('예시선발'))
  assert.ok(other.svg.includes('3-4-3'))
  assert.ok(other.svg.includes('저장된 스쿼드'))
})

test('halves label, missing names/numbers, guests and invalid periods are handled without IDs', () => {
  const input = { ...fixture(), internal: false, team: 'B', matchFormat: 'TWO_HALVES_30', quarter: 2 }
  const result = buildSquadImage(input)
  assert.ok(result.svg.includes('후반(2쿼터)'))
  assert.ok(result.svg.includes('다른쿼터선수'))
  assert.equal(result.filename, 'jochook-on-2026-10-25-2Q.png')
  assert.throws(() => buildSquadImage({ ...input, quarter: 3 }), /현재 경기 형식/)
  const guest = fixture(); guest.participants[0] = { ...guest.participants[0], shirtNumber: null, playerType: 'GUEST' }
  assert.ok(buildSquadImage(guest).svg.includes('용병 · 번호 없음'))
  guest.participants = []
  assert.ok(buildSquadImage(guest).svg.includes('선수 미확인'))
})

test('names and metadata are escaped; output has no embedded remote resources', () => {
  const input = fixture()
  input.teamName = '<script>alert(1)</script> & "팀"'
  input.participants[0].name = '<image href="https://example.com"/>'
  const { svg } = buildSquadImage(input)
  assert.ok(svg.includes('&lt;script&gt;'))
  assert.ok(svg.includes('&amp;'))
  assert.ok(!svg.includes('<script>'))
  assert.ok(!svg.includes('<image'))
  assert.ok(!svg.includes('foreignObject'))
  assert.ok(!svg.includes('1996'))
})

test('all six formations fit eleven distinct cards including substitutes without overlap', () => {
  for (const formation of formationOptions) {
    const positions = squadImagePositions(formation)
    assert.equal(new Set(positions.map(p => p.slot)).size, 11)
    for (const a of positions) {
      assert.ok(a.x - 101 >= 26 && a.x + 101 <= 1054)
      assert.ok(a.y - 67 >= 280 && a.y + 81 < 1316)
      for (const b of positions.filter(p => p.slot !== a.slot)) assert.ok(Math.abs(a.x - b.x) >= 202 || Math.abs(a.y - b.y) >= 148, `${formation} ${a.slot}/${b.slot}`)
    }
  }
  const pos = Object.fromEntries(squadImagePositions('F352').map(p => [p.slot, p]))
  assert.ok(pos.CAM.y < pos.LWB.y && pos.LWB.y < pos.LCM.y && pos.LCM.y < pos.CCB.y)
})
