import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeCompletion } from '../src/features/matches/completionReview.ts'
import { pitchRowsFor } from '../src/features/matches/formations.ts'

const participant = (playerId, patch = {}) => ({ playerId, name: `가상 선수 ${playerId}`, shirtNumber: playerId, birthYear: null, playerType: 'MEMBER', vote: 'ATTENDING', attendance: 'PRESENT', ...patch })
const entry = (playerId, slot = 'GK', patch = {}) => ({ playerId, slot, team: 'A', entryOrder: 0, goals: 0, assists: 0, ...patch })
const match = (patch = {}) => ({ kind: 'EXTERNAL', playedOn: '2026-10-15', kickoff: '11:00', venue: '', opponent: '가상 상대', notes: '', scoreFor: null, scoreAgainst: null, formationA: 'F4123', formationB: 'F4123', participants: [], plannedLineup: [], quarters: [1, 2, 3, 4].map(number => ({ number, lineup: [] })), ...patch })
const fullLineup = (formation = 'F4123', team = 'A', startId = 1) => pitchRowsFor(formation).flat().map((slot, index) => entry(startId + index, slot, { team }))
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

test('an empty record shows all four actual quarters and unrecorded score without inventing completion', () => {
  const result = analyzeCompletion(match())
  assert.equal(result.quarters.length, 4)
  assert.deepEqual(result.quarters.map(q => [q.quarter, q.team, q.starterCount, q.requiredCount, q.missingSlots.length]), [1, 2, 3, 4].map(q => [q, 'A', 0, 11, 11]))
  assert.equal(result.scoreInput, 'unrecorded')
  assert.deepEqual(result.scores, [{ team: 'A', score: null, playerGoals: 0, status: 'unrecorded' }])
  assert.equal(Object.hasOwn(result, 'canComplete'), false)
})

test('only attending voters with unconfirmed actual attendance are listed and actual shirt numbers drive sorting', () => {
  const people = [participant(101, { shirtNumber: null, attendance: 'UNCONFIRMED' }), participant(9, { shirtNumber: 2, attendance: 'UNCONFIRMED' }), participant(1, { shirtNumber: 90, attendance: 'UNCONFIRMED' }),
    participant(2, { vote: 'UNDECIDED', attendance: 'UNCONFIRMED' }), participant(3, { vote: 'ABSENT', attendance: 'UNCONFIRMED' }), participant(4, { vote: 'UNANSWERED', attendance: 'UNCONFIRMED' }), participant(5), participant(6, { attendance: 'LATE' }), participant(7, { attendance: 'ABSENT' })]
  assert.deepEqual(analyzeCompletion(match({ participants: people })).unconfirmedAttendees.map(p => p.playerId), [9, 1, 101])
})

test('two substitutes neither fill empty starter seats nor inflate the starter count, but their goals are counted', () => {
  const lineup = [entry(1), entry(12, 'GK', { entryOrder: 1, goals: 1 }), entry(2, 'LW'), entry(13, 'LW', { entryOrder: 1, goals: 2 })]
  const source = match({ scoreFor: 3, scoreAgainst: 0, quarters: [{ number: 1, lineup }, ...[2, 3, 4].map(number => ({ number, lineup: [] }))] })
  const result = analyzeCompletion(source)
  assert.equal(result.quarters[0].starterCount, 2)
  assert.equal(result.quarters[0].missingSlots.length, 9)
  assert.ok(!result.quarters[0].missingSlots.includes('GK'))
  assert.ok(result.quarters[0].missingSlots.includes('ST'))
  assert.deepEqual(result.scores[0], { team: 'A', score: 3, playerGoals: 3, status: 'matches' })
})

test('planning a full squad does not fill actual seats or count attendance as an appearance', () => {
  const source = match({ participants: [participant(1), participant(2, { attendance: 'LATE' }), participant(3, { attendance: 'UNCONFIRMED' }), participant(4, { attendance: 'ABSENT' })], plannedLineup: fullLineup().map(e => ({ ...e, quarterNumber: 1 })) })
  const result = analyzeCompletion(source)
  assert.deepEqual(result.attendeesWithoutAppearance.map(p => p.playerId), [1, 2])
  assert.ok(result.quarters.every(q => q.starterCount === 0))
})

test('one actual substitute appearance is enough to remove a present or late player from the no-appearance list', () => {
  const source = match({ participants: [participant(1), participant(2, { attendance: 'LATE' }), participant(3), participant(4, { attendance: 'ABSENT' })], quarters: [{ number: 4, lineup: [entry(1), entry(2, 'GK', { entryOrder: 1 })] }] })
  const result = analyzeCompletion(source)
  assert.deepEqual(result.attendeesWithoutAppearance.map(p => p.playerId), [3])
  assert.equal(result.quarters.find(q => q.quarter === 4).starterCount, 1)
  assert.equal(result.quarters.length, 4)
})

test('internal matches separately check both teams with their own formation and do not share filled seats', () => {
  const source = match({ kind: 'INTERNAL', formationA: 'F352', formationB: 'F4231', quarters: [1, 2, 3, 4].map(number => ({ number, lineup: [...fullLineup('F352'), ...fullLineup('F4231', 'B', 12).filter(e => number !== 2 || e.slot !== 'CAM')] })) })
  const result = analyzeCompletion(source)
  assert.equal(result.quarters.length, 8)
  assert.deepEqual(result.quarters.filter(q => q.missingSlots.length), [{ quarter: 2, team: 'B', starterCount: 10, requiredCount: 11, missingSlots: ['CAM'] }])
  assert.equal(result.scores.length, 2)
})

test('all supported formations count their own eleven starter seats, including wingbacks and attacking midfield', () => {
  for (const formation of ['F4123', 'F442', 'F4231', 'F4141', 'F352', 'F343']) {
    const source = match({ formationA: formation, quarters: [1, 2, 3, 4].map(number => ({ number, lineup: fullLineup(formation) })) })
    assert.ok(analyzeCompletion(source).quarters.every(q => q.starterCount === 11 && q.missingSlots.length === 0), formation)
  }
})

test('a complete external zero-zero lineup has no score mismatch and no unplayed attendees', () => {
  const source = match({ scoreFor: 0, scoreAgainst: 0, participants: Array.from({ length: 11 }, (_, index) => participant(index + 1)), quarters: [1, 2, 3, 4].map(number => ({ number, lineup: fullLineup() })) })
  const result = analyzeCompletion(source)
  assert.equal(result.scoreInput, 'recorded')
  assert.ok(result.quarters.every(q => q.starterCount === 11 && q.missingSlots.length === 0))
  assert.deepEqual(result.attendeesWithoutAppearance, [])
  assert.equal(result.scores[0].status, 'matches')
})

test('both complete internal zero-zero teams are reviewed as full rather than as one shared eleven', () => {
  const source = match({ kind: 'INTERNAL', scoreFor: 0, scoreAgainst: 0, quarters: [1, 2, 3, 4].map(number => ({ number, lineup: [...fullLineup(), ...fullLineup('F4123', 'B', 12)] })) })
  const result = analyzeCompletion(source)
  assert.equal(result.quarters.length, 8)
  assert.ok(result.quarters.every(q => q.starterCount === 11 && q.missingSlots.length === 0))
  assert.deepEqual(result.scores.map(s => s.status), ['matches', 'matches'])
})

test('external score comparison uses our goals only while either missing final score is distinguished from zero', () => {
  const source = match({ scoreFor: 2, scoreAgainst: 9, quarters: [{ number: 1, lineup: [entry(1, 'ST', { goals: 1 })] }] })
  assert.deepEqual(analyzeCompletion(source).scores, [{ team: 'A', score: 2, playerGoals: 1, status: 'differs' }])
  assert.equal(analyzeCompletion({ ...source, scoreFor: 1 }).scores[0].status, 'matches')
  for (const scores of [{ scoreFor: 0, scoreAgainst: null }, { scoreFor: null, scoreAgainst: 0 }]) {
    assert.equal(analyzeCompletion(match(scores)).scoreInput, 'partial')
  }
  assert.equal(analyzeCompletion(match({ scoreFor: null, scoreAgainst: 0 })).scores[0].status, 'unrecorded')
})

test('internal score comparison sums starters and substitutes over all quarters for each team', () => {
  const source = match({ kind: 'INTERNAL', scoreFor: 2, scoreAgainst: 3, quarters: [{ number: 1, lineup: [entry(1, 'ST', { goals: 1 }), entry(2, 'ST', { team: 'B', goals: 1 })] }, { number: 4, lineup: [entry(3, 'ST', { goals: 1 }), entry(4, 'ST', { team: 'B', goals: 0 }), entry(5, 'ST', { team: 'B', entryOrder: 1, goals: 1 })] }] })
  assert.deepEqual(analyzeCompletion(source).scores, [{ team: 'A', score: 2, playerGoals: 2, status: 'matches' }, { team: 'B', score: 3, playerGoals: 2, status: 'differs' }])
})

test('advisory analysis leaves frozen records, participant order, goals and recording stage unchanged', () => {
  const source = freeze(match({ recordingStage: 'COMPLETED', participants: [participant(9), participant(2)], quarters: [1, 2, 3, 4].map(number => ({ number, lineup: number === 3 ? [entry(9, 'ST', { goals: 1 })] : [] })) }))
  const before = structuredClone(source)
  analyzeCompletion(source)
  assert.deepEqual(source, before)
})
