import test from 'node:test'
import assert from 'node:assert/strict'
import { assignPlannedTeam, checkInternalPlanTeams, internalTeamCandidates, plannedTeamPlayers, setInternalTeamSelection, teamChangeRemovesPlan, unassignedAttendees, withEditablePlannedTeams } from '../src/features/matches/internalTeams.ts'
import { generateMatchPlan } from '../src/features/matches/automaticPlan.ts'
import { checkPlan, placeInPlan } from '../src/features/matches/plan.ts'

const player = (playerId, plannedTeam, vote = 'ATTENDING') => ({ playerId, name: `가상 선수 ${playerId}`, plannedTeam, vote, attendance: 'PRESENT', shirtNumber: playerId, birthYear: 1995, playerType: 'MEMBER' })
const entry = (playerId, team = 'A', quarterNumber = 1, entryOrder = 0, slot = 'ST') => ({ playerId, team, quarterNumber, entryOrder, slot })
const fixture = () => ({ kind: 'INTERNAL', playedOn: '2026-10-15', formationA: 'F352', formationB: 'F343',
  participants: [player(1, 'A'), player(2, 'A'), player(3, 'B'), player(4, 'B')],
  plannedLineup: [entry(1), entry(2, 'A', 1, 1), entry(3, 'B'), entry(1, 'A', 2)],
  quarters: [{ number: 1, lineup: [{ ...entry(1), goals: 2, assists: 1, freeKickGoals: 1, penaltyGoals: 0 }] }] })
const candidate = playerId => ({ playerId, name: `가상 선수 ${playerId}`, shirtNumber: playerId, birthYear: 1995, playerType: 'MEMBER', preferences: [], existingOnly: false })
const profile = (id, patch = {}) => ({ id, name: `명단 선수 ${id}`, shirtNumber: id, birthYear: 1998, playerType: 'MEMBER', firstChoice: 'CM', secondChoice: 'ST', thirdChoice: null, ...patch })
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

test('team picker starts with the active roster plus existing inactive participants and this match guests, with no duplicates', () => {
  const profiles = freeze([profile(4), profile(2), profile(20, { playerType: 'GUEST', shirtNumber: null }), profile(21, { playerType: 'GUEST', shirtNumber: null })])
  const participants = freeze([player(2, 'A'), player(7, null, 'UNANSWERED'), { ...player(20, null), playerType: 'GUEST', shirtNumber: null }])
  const options = internalTeamCandidates(profiles, participants)
  assert.deepEqual(options.map(p => p.playerId), [2, 4, 7, 20])
  assert.deepEqual(options[0].preferences, ['CM', 'ST'])
  assert.equal(options[0].name, participants[0].name, 'existing participant identity stays visible')
  assert.equal(options[2].existingOnly, true)
  assert.equal(options[2].name, participants[1].name)
  assert.equal(options.some(p => p.playerId === 21), false, 'an unrelated guest is not added to this match')
})

test('checking an active roster player directly creates attendance intent and its selected team without confirming actual attendance', () => {
  const draft = freeze(fixture()), before = structuredClone(draft)
  const next = setInternalTeamSelection(draft, candidate(9), 'B', true)
  assert.deepEqual(next.participants.at(-1), { ...player(9, 'B'), attendance: 'UNCONFIRMED' })
  assert.equal(next.quarters, draft.quarters)
  assert.deepEqual(next.plannedLineup, draft.plannedLineup)
  assert.deepEqual(draft, before)
})

test('selecting existing undecided or unanswered players sets team and vote while preserving actual attendance and identity', () => {
  for (const vote of ['UNANSWERED', 'UNDECIDED', 'ABSENT']) {
    const draft = fixture()
    draft.participants[0] = { ...draft.participants[0], plannedTeam: null, vote, attendance: 'LATE' }
    const next = setInternalTeamSelection(freeze(draft), { ...candidate(1), name: '다른 명단 이름' }, 'A', true)
    assert.deepEqual(next.participants[0], { ...draft.participants[0], plannedTeam: 'A', vote: 'ATTENDING' })
    assert.equal(next.participants.length, draft.participants.length)
    assert.equal(next.quarters, draft.quarters)
    assert.deepEqual(next.plannedLineup, draft.plannedLineup)
  }
})

test('unassigned attending guests can be selected into a team without a shirt number', () => {
  const draft = fixture()
  draft.participants.push({ ...player(20, null), playerType: 'GUEST', shirtNumber: null, attendance: 'UNCONFIRMED' })
  const guest = internalTeamCandidates([], draft.participants).find(p => p.playerId === 20)
  const next = setInternalTeamSelection(freeze(draft), guest, 'B', true)
  assert.equal(next.participants.at(-1).plannedTeam, 'B')
  assert.equal(next.participants.at(-1).shirtNumber, null)
  assert.equal(next.participants.at(-1).playerType, 'GUEST')
  assert.equal(unassignedAttendees(next.participants).length, 0)
})

test('a team checkbox cannot select or deselect another team player; an explicit move is required', () => {
  const draft = freeze(fixture()), before = structuredClone(draft)
  for (const selected of [true, false]) assert.throws(() => setInternalTeamSelection(draft, candidate(3), 'A', selected), /팀 이동/)
  assert.deepEqual(draft, before)
  const moved = assignPlannedTeam(draft, 3, 'A')
  assert.equal(moved.participants[2].plannedTeam, 'A')
  assert.equal(moved.participants[2].vote, 'ATTENDING')
  assert.equal(moved.quarters, draft.quarters)
})

test('unchecking a starter clears intent and all of that player plans, promotes only their substitute, and preserves goals and attendance', () => {
  const draft = freeze(fixture()), before = structuredClone(draft)
  assert.equal(teamChangeRemovesPlan(draft, 1, null), true)
  const next = setInternalTeamSelection(draft, candidate(1), 'A', false)
  assert.deepEqual(next.participants[0], { ...draft.participants[0], plannedTeam: null, vote: 'UNANSWERED' })
  assert.equal(next.participants[0].attendance, 'PRESENT')
  assert.equal(next.plannedLineup.some(p => p.playerId === 1), false)
  assert.equal(next.plannedLineup.find(p => p.playerId === 2).entryOrder, 0)
  assert.equal(next.plannedLineup.find(p => p.playerId === 3), draft.plannedLineup[2])
  assert.equal(next.quarters, draft.quarters)
  assert.equal(next.quarters[0].lineup[0].goals, 2)
  assert.equal(next.quarters[0].lineup[0].assists, 1)
  assert.doesNotThrow(() => checkPlan(next.plannedLineup, next.participants))
  assert.deepEqual(draft, before)
})

test('unchecking a substitute preserves its starter, every other participant, and all actual entries', () => {
  const draft = freeze(fixture())
  const next = setInternalTeamSelection(draft, candidate(2), 'A', false)
  assert.equal(next.plannedLineup.filter(p => p.playerId === 1).length, 2)
  assert.equal(next.plannedLineup[0].entryOrder, 0)
  assert.equal(next.participants[0], draft.participants[0])
  assert.equal(next.participants[2], draft.participants[2])
  assert.equal(next.participants[1].vote, 'UNANSWERED')
  assert.equal(next.participants[1].plannedTeam, null)
  assert.equal(next.quarters, draft.quarters)
})

test('repeated unchecking is a no-op and external matches cannot enter the team-picker flow', () => {
  const draft = fixture()
  assert.equal(setInternalTeamSelection(draft, candidate(99), 'A', false), draft)
  const cleared = setInternalTeamSelection(draft, candidate(1), 'A', false)
  assert.equal(setInternalTeamSelection(cleared, candidate(1), 'A', false), cleared)
  assert.throws(() => setInternalTeamSelection({ ...draft, kind: 'EXTERNAL' }, candidate(1), 'A', true), /자체전/)
})

test('team-card selection enforces the 200-participant limit without blocking edits to existing participants', () => {
  const draft = fixture()
  draft.participants = Array.from({ length: 200 }, (_, index) => player(index + 1, null, 'UNANSWERED'))
  const before = structuredClone(draft)
  freeze(draft)
  assert.throws(() => setInternalTeamSelection(draft, candidate(201), 'A', true), /최대 200명/)
  assert.deepEqual(draft, before)
  const edited = setInternalTeamSelection(draft, candidate(1), 'A', true)
  assert.equal(edited.participants.length, 200)
  assert.equal(edited.participants[0].plannedTeam, 'A')
  assert.equal(edited.participants[0].vote, 'ATTENDING')
  const room = { ...draft, participants: draft.participants.slice(0, 199) }
  assert.equal(setInternalTeamSelection(room, candidate(201), 'B', true).participants.length, 200)
})

test('teams include attending members and guests only, leaving nonattendance out of readiness', () => {
  const people = [player(1, 'A'), { ...player(2, null), playerType: 'GUEST' }, player(3, null, 'UNANSWERED'), player(4, 'B')]
  assert.deepEqual(plannedTeamPlayers(people, 'A').map(p => p.playerId), [1])
  assert.deepEqual(unassignedAttendees(people).map(p => p.playerId), [2])
})

test('new placements, replacements and stale drags reject another assigned team across all quarters', () => {
  const draft = fixture(), before = structuredClone(draft)
  assert.throws(() => placeInPlan(draft.plannedLineup, 4, 'GK', 0, 1, 'B', draft.participants), /팀 배정/)
  assert.throws(() => placeInPlan(draft.plannedLineup, 1, 'ST', 0, 4, 'A', draft.participants), /팀 배정/)
  const changedRoster = draft.participants.map(p => p.playerId === 4 ? { ...p, plannedTeam: 'A' } : p)
  assert.throws(() => placeInPlan([], 1, 'GK', 0, 4, 'B', changedRoster), /팀 배정/)
  assert.deepEqual(draft, before)
})

test('valid within-team swaps and copies preserve both memberships', () => {
  const draft = fixture()
  const swapped = placeInPlan(draft.plannedLineup, 1, 'ST', 1, 1, 'A', draft.participants)
  assert.equal(swapped.find(e => e.playerId === 2 && e.quarterNumber === 1).entryOrder, 0)
  assert.equal(swapped.find(e => e.playerId === 3).team, 'B')
  const copied = [...swapped.filter(e => e.quarterNumber !== 4), ...swapped.filter(e => e.quarterNumber === 1).map(e => ({ ...e, quarterNumber: 4 }))]
  assert.doesNotThrow(() => checkPlan(copied, draft.participants))
  assert.throws(() => checkPlan(copied, draft.participants.map(p => p.playerId === 3 ? { ...p, plannedTeam: 'A' } : p)), /팀 배정/)
})

test('moving a player removes only their conflicting plans and promotes remaining substitute without touching actual stats', () => {
  const draft = fixture(), before = structuredClone(draft)
  assert.equal(teamChangeRemovesPlan(draft, 1, 'B'), true)
  assert.equal(teamChangeRemovesPlan(draft, 1, 'A'), false)
  const next = assignPlannedTeam(draft, 1, 'B')
  assert.equal(next.participants[0].plannedTeam, 'B')
  assert.equal(next.plannedLineup.some(e => e.playerId === 1), false)
  assert.equal(next.plannedLineup.find(e => e.playerId === 2).entryOrder, 0)
  assert.deepEqual(next.plannedLineup.find(e => e.playerId === 3), draft.plannedLineup[2])
  assert.equal(next.quarters, draft.quarters)
  assert.deepEqual(draft, before)
  assert.doesNotThrow(() => checkPlan(next.plannedLineup, next.participants))
})

test('clearing a substitute removes only that player and unassigned intermediate drafts with empty plans are valid', () => {
  const next = assignPlannedTeam(fixture(), 2, null)
  assert.equal(next.plannedLineup.length, 3)
  assert.equal(next.plannedLineup[0].entryOrder, 0)
  assert.equal(unassignedAttendees(next.participants).length, 1)
  assert.doesNotThrow(() => checkInternalPlanTeams([], next.participants))
  assert.throws(() => assignPlannedTeam({ ...fixture(), kind: 'EXTERNAL' }, 1, 'B'), /자체전/)
})

test('editable old drafts infer only stable teams and never override explicit unassignment', () => {
  const draft = fixture()
  draft.participants = [player(1, undefined), player(2, null), player(3, undefined), player(4, undefined)]
  draft.plannedLineup.push(entry(3, 'A', 3))
  const normalized = withEditablePlannedTeams(draft)
  assert.deepEqual(normalized.participants.map(p => p.plannedTeam), ['A', null, null, null])
  assert.equal(draft.participants[0].plannedTeam, undefined)
  assert.equal(normalized.quarters, draft.quarters)
})

const suggestion = ids => ({ policyVersion: 'fixture', seed: 1, plannedLineup: ids.map((id, index) => entry(id, 'A', 1, 0, index ? 'GK' : 'ST')), warnings: ['인원 확인'], allocations: ids.map(playerId => ({ playerId })), optimal: true })

test('automatic internal planning sends separate teams sequentially with each formation and remaps both results', async () => {
  const draft = fixture(), calls = [], signal = new AbortController().signal
  const result = await generateMatchPlan(draft, 9, 12, signal, async (date, ids, matchId, seed, receivedSignal, formation) => {
    calls.push({ date, ids, matchId, seed, receivedSignal, formation })
    assert.equal(calls.length, ids[0] === 1 ? 1 : 2)
    return suggestion(ids)
  })
  assert.deepEqual(calls.map(c => [c.ids, c.formation]), [[[1, 2], 'F352'], [[3, 4], 'F343']])
  assert.deepEqual(result.plannedLineup.map(e => [e.playerId, e.team]), [[1, 'A'], [2, 'A'], [3, 'B'], [4, 'B']])
  assert.deepEqual(result.warnings, ['A팀 · 인원 확인', 'B팀 · 인원 확인'])
  assert.ok(calls.every(c => c.matchId === 9 && c.seed === 12 && c.receivedSignal === signal))
})

test('second-team failure and cancellation return no partial plan and preserve the source draft', async () => {
  const draft = fixture(), before = structuredClone(draft)
  let calls = 0
  await assert.rejects(generateMatchPlan(draft, null, 1, new AbortController().signal, async (_date, ids) => {
    calls++; if (calls === 2) throw new Error('B팀 계산 실패'); return suggestion(ids)
  }), /B팀 계산 실패/)
  assert.equal(calls, 2); assert.deepEqual(draft, before)
  const controller = new AbortController(); calls = 0
  await assert.rejects(generateMatchPlan(draft, null, 1, controller.signal, async (_date, ids) => { calls++; controller.abort(); return suggestion(ids) }), { name: 'AbortError' })
  assert.equal(calls, 1); assert.deepEqual(draft, before)
})

test('unassigned or empty teams stop before any API call, and foreign suggestion IDs are rejected', async () => {
  const draft = fixture(); let calls = 0
  draft.participants[0].plannedTeam = null
  await assert.rejects(generateMatchPlan(draft, null, 1, new AbortController().signal, async () => { calls++; return suggestion([]) }), /모두 배정/)
  assert.equal(calls, 0)
  draft.participants.forEach(p => { p.plannedTeam = 'A' })
  await assert.rejects(generateMatchPlan(draft, null, 1, new AbortController().signal, async () => { calls++; return suggestion([]) }), /각각/)
  assert.equal(calls, 0)
  await assert.rejects(generateMatchPlan(fixture(), null, 1, new AbortController().signal, async () => suggestion([3])), /팀 배정/)
})
