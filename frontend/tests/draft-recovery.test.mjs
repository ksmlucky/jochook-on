import test from 'node:test'
import assert from 'node:assert/strict'
import { clearAccountRecoveries, clearMatchRecovery, loadMatchRecovery, RECOVERY_TTL_MS, saveMatchRecovery } from '../src/features/matches/draftRecovery.ts'
import { toMatchPayload } from '../src/features/matches/matchPayload.ts'

function store() {
  const values = new Map()
  return { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k),
    key: i => [...values.keys()][i] ?? null, get length() { return values.size } }
}
const now = Date.UTC(2026, 9, 15)
const owner = { username: 'fixture-manager', teamId: 1 }
const player = { playerId: 1, name: '가상 선수', shirtNumber: 1, birthYear: 1996, playerType: 'MEMBER', vote: 'ATTENDING', attendance: 'PRESENT' }
const draft = () => ({ kind: 'EXTERNAL', playedOn: '2026-10-15', kickoff: null, venue: '', opponent: '', notes: '작성 중', scoreFor: null, scoreAgainst: null,
  formationA: 'F352', formationB: 'F4123', participants: [{...player}], quarters: [1,2,3,4].map(number=>({number,lineup:[]})), plannedLineup: [] })
const snapshot = () => ({schema:1, owner:{...owner}, savedAt:now, record:null, draft:draft(), kickoffHour:'11', kickoffMinute:'', step:2, quarter:4, team:'A', pending:null})

test('two-half recovery preserves format and only two periods while an old frozen request remains unchanged', () => {
  const s=store(), value=snapshot()
  value.draft={...value.draft,matchFormat:'TWO_HALVES_30',quarters:value.draft.quarters.slice(0,2)}
  value.quarter=2
  value.pending={key:'00000000-0000-4000-8000-000000000001',draft:draft(),record:null,destination:'save'}
  const oldBody=JSON.stringify(toMatchPayload(value.pending.draft,null))
  assert.equal(saveMatchRecovery(value,s,now),true)
  const restored=loadMatchRecovery(owner,s,now)
  assert.equal(restored.draft.matchFormat,'TWO_HALVES_30')
  assert.deepEqual(restored.draft.quarters.map(q=>q.number),[1,2])
  assert.equal(JSON.stringify(toMatchPayload(restored.pending.draft,null)),oldBody)
  assert.equal('matchFormat' in restored.pending.draft,false)
  for(const patch of [{matchFormat:'INVALID'},{matchFormat:'TWO_HALVES_30',kind:'INTERNAL'},{matchFormat:'TWO_HALVES_30',quarters:draft().quarters}]){
    assert.equal(saveMatchRecovery({...value,draft:{...value.draft,...patch}},store(),now),false)
  }
})

test('planned teams survive recovery and frozen legacy retry payloads remain byte-identical', () => {
  for (const fields of [{}, { plannedTeam: null }, { plannedTeam: 'A' }, { plannedTeam: 'B' }]) {
    const s=store(), value=snapshot()
    Object.assign(value.draft.participants[0],fields)
    value.pending={key:'00000000-0000-4000-8000-000000000001',draft:structuredClone(value.draft),record:null,destination:'save'}
    const payload=JSON.stringify(toMatchPayload(value.pending.draft,null))
    assert.equal(saveMatchRecovery(value,s,now),true)
    const restored=loadMatchRecovery(owner,s,now)
    assert.equal(JSON.stringify(toMatchPayload(restored.pending.draft,null)),payload)
    assert.deepEqual(restored.draft.participants,value.draft.participants)
    const sent=toMatchPayload(restored.draft,null).participants[0]
    assert.equal('plannedTeamSpecified' in sent,'plannedTeam' in fields)
    if ('plannedTeam' in fields) assert.equal(sent.plannedTeamSpecified,true)
  }
  for (const invalid of ['C', 1, {}, false]) {
    const value=snapshot(); value.draft.participants[0].plannedTeam=invalid
    assert.equal(saveMatchRecovery(value,store(),now),false)
  }
})

test('goal breakdown survives recovery and frozen retries without manufacturing new zero fields', () => {
  for (const fields of [{}, { freeKickGoals: null, penaltyGoals: null }, { freeKickGoals: 0, penaltyGoals: 0 }, { freeKickGoals: 1, penaltyGoals: 1 }]) {
    const s=store(), value=snapshot()
    value.draft.quarters[0].lineup=[{team:'A',slot:'ST',entryOrder:0,playerId:1,goals:3,assists:0,...fields}]
    value.record={...structuredClone(value.draft),id:1,version:2}
    value.pending={key:'00000000-0000-4000-8000-000000000001',draft:structuredClone(value.draft),record:structuredClone(value.record),destination:'save'}
    const body=JSON.stringify(toMatchPayload(value.pending.draft,value.record))
    assert.equal(saveMatchRecovery(value,s,now),true)
    const restored=loadMatchRecovery(owner,s,now)
    assert.deepEqual(restored.draft.quarters,value.draft.quarters)
    assert.deepEqual(restored.record.quarters,value.record.quarters)
    assert.deepEqual(toMatchPayload(restored.pending.draft,restored.pending.record).quarters,JSON.parse(body).quarters)
  }
})

test('invalid breakdown types cannot corrupt recovery while a sum needing correction stays recoverable', () => {
  for (const field of ['freeKickGoals','penaltyGoals']) for (const amount of ['1',-1,100,.5,NaN,Infinity]) {
    const value=snapshot(); value.draft.quarters[0].lineup=[{team:'A',slot:'ST',entryOrder:0,playerId:1,goals:3,assists:0,[field]:amount}]
    assert.equal(saveMatchRecovery(value,store(),now),false)
  }
  const value=snapshot(); value.draft.quarters[0].lineup=[{team:'A',slot:'ST',entryOrder:0,playerId:1,goals:0,assists:0,freeKickGoals:1}]
  assert.equal(saveMatchRecovery(value,store(),now),true)
})

test('tournament selection survives recovery without adding new fields to a frozen legacy retry', () => {
  const s=store(), value=snapshot()
  value.draft={...value.draft,tournamentId:8,tournamentName:'가상 봄 대회',tournamentStage:'FINAL',tournamentSelectionSpecified:true}
  value.pending={key:'00000000-0000-4000-8000-000000000001',draft:draft(),record:null,destination:'save'}
  const body=JSON.stringify(toMatchPayload(value.pending.draft,null))
  assert.equal(saveMatchRecovery(value,s,now),true)
  const restored=loadMatchRecovery(owner,s,now)
  assert.equal(restored.draft.tournamentId,8)
  assert.equal(restored.draft.tournamentStage,'FINAL')
  assert.equal(restored.draft.tournamentName,'가상 봄 대회')
  assert.equal(JSON.stringify(toMatchPayload(restored.pending.draft,null)),body)
  assert.equal('tournamentSelectionSpecified' in restored.pending.draft,false)
})
test('explicit tournament removal survives recovery and includes a clear signal', () => {
  const s=store(), value=snapshot()
  value.draft={...value.draft,tournamentId:null,tournamentStage:null,tournamentSelectionSpecified:true}
  assert.equal(saveMatchRecovery(value,s,now),true)
  const payload=toMatchPayload(loadMatchRecovery(owner,s,now).draft,null)
  assert.equal(payload.tournamentSelectionSpecified,true)
  assert.equal(payload.tournamentId,null); assert.equal(payload.tournamentStage,null)
  assert.equal('tournamentName' in payload,false)
})
test('malformed tournament fields cannot restore an invalid draft', () => {
  for(const patch of [{tournamentId:-1},{tournamentId:'8'},{tournamentStage:'INVALID'},{tournamentName:'x'.repeat(121)},{tournamentSelectionSpecified:'true'}]) {
    const value=snapshot();Object.assign(value.draft,patch)
    assert.equal(saveMatchRecovery(value,store(),now),false)
  }
})

test('refresh recovery preserves partial time, position in editor, and unsaved data without changing the input', () => {
  const s=store(), input=snapshot(), before=structuredClone(input)
  assert.equal(saveMatchRecovery(input,s,now),true)
  input.draft.notes='later memory edit'
  assert.deepEqual(loadMatchRecovery(owner,s,now+10),before)
})
test('account and team boundaries isolate recovery even if stored owner was changed', () => {
  const s=store(); saveMatchRecovery(snapshot(),s,now)
  assert.equal(loadMatchRecovery({...owner,teamId:2},s,now),null)
  assert.equal(loadMatchRecovery({...owner,username:'another'},s,now),null)
  const value=JSON.parse(s.getItem(s.key(0))); value.owner.teamId=2; s.setItem(s.key(0),JSON.stringify(value))
  assert.equal(loadMatchRecovery(owner,s,now),null); assert.equal(s.length,0)
})
test('expired and implausibly future copies are discarded', () => {
  const s=store(); saveMatchRecovery(snapshot(),s,now)
  assert.ok(loadMatchRecovery(owner,s,now+RECOVERY_TTL_MS-1))
  assert.equal(loadMatchRecovery(owner,s,now+RECOVERY_TTL_MS),null); assert.equal(s.length,0)
  saveMatchRecovery(snapshot(),s,now+120_000)
  assert.equal(loadMatchRecovery(owner,s,now),null)
})
test('explicit logout clears all this account’s team copies but not another account or unrelated storage', () => {
  const s=store(); saveMatchRecovery(snapshot(),s,now)
  saveMatchRecovery({...snapshot(),owner:{...owner,teamId:2}},s,now)
  saveMatchRecovery({...snapshot(),owner:{...owner,username:'other'}},s,now)
  s.setItem('unrelated','keep'); clearAccountRecoveries(owner.username,s)
  assert.equal(s.length,2); assert.ok(loadMatchRecovery({...owner,username:'other'},s,now)); assert.equal(s.getItem('unrelated'),'keep')
})
test('successful save cleanup affects only the selected account/team', () => {
  const s=store(); saveMatchRecovery(snapshot(),s,now); saveMatchRecovery({...snapshot(),owner:{...owner,teamId:2}},s,now)
  clearMatchRecovery(owner,s); assert.equal(loadMatchRecovery(owner,s,now),null); assert.equal(s.length,1)
})
test('malformed or incompatible snapshots do not crash or replace a good recovery', () => {
  const s=store(); saveMatchRecovery(snapshot(),s,now)
  assert.equal(saveMatchRecovery({...snapshot(),schema:2},s,now),false)
  assert.ok(loadMatchRecovery(owner,s,now))
  const key=s.key(0); s.setItem(key,'{broken'); assert.equal(loadMatchRecovery(owner,s,now),null)
  s.setItem(key,JSON.stringify({...snapshot(),schema:2})); assert.equal(loadMatchRecovery(owner,s,now),null)
})
test('invalid nested data or missing quarter is rejected before any editor restores it', () => {
  for (const mutate of [v=>v.draft.quarters.pop(),v=>v.draft.quarters[0].number=2,v=>v.draft.participants.push({...player}),
    v=>v.draft.formationA='F999',v=>v.draft.participants[0].vote='UNKNOWN',v=>v.step=99,
    v=>v.draft.quarters[0].lineup.push({team:'A',slot:'ST',playerId:1,entryOrder:0,goals:NaN,assists:0})]) {
    const s=store(),value=snapshot();mutate(value);assert.equal(saveMatchRecovery(value,s,now),false)
  }
})
test('pending retries preserve the exact draft, key, destination, and base version', () => {
  const s=store(),value=snapshot(),record={...draft(),id:5,version:7}
  value.record=record;value.pending={key:'00000000-0000-4000-8000-000000000001',draft:{...draft(),kickoff:'11:30'},record,destination:'totals'}
  assert.equal(saveMatchRecovery(value,s,now),true)
  assert.deepEqual(loadMatchRecovery(owner,s,now),value)
  value.pending.record={...record,version:8};assert.equal(saveMatchRecovery(value,s,now),false)
})
test('API seconds are preserved for an existing record and retry payload', () => {
  const s=store(),value=snapshot();value.draft.kickoff='11:30:00';value.record={...value.draft,id:1,version:0}
  assert.equal(saveMatchRecovery(value,s,now),true);assert.equal(loadMatchRecovery(owner,s,now).record.kickoff,'11:30:00')
})
test('a legacy base time does not prevent recovery while the draft corrects its interval', () => {
  const s=store(),value=snapshot();value.record={...draft(),id:1,version:0,kickoff:'11:15:00'}
  value.draft.kickoff='11:30';value.kickoffMinute='30'
  assert.equal(saveMatchRecovery(value,s,now),true)
  assert.equal(loadMatchRecovery(owner,s,now).record.kickoff,'11:15:00')
  assert.equal(loadMatchRecovery(owner,s,now).draft.kickoff,'11:30')
  value.record.kickoff='25:00';assert.equal(saveMatchRecovery(value,s,now),false)
})
test('storage quota or blocked storage fails explicitly and leaves the current input untouched', () => {
  const blocked={...store(),getItem(){throw Error('blocked')},setItem(){throw Error('quota')},removeItem(){throw Error('blocked')}}
  const input=snapshot(),before=structuredClone(input)
  assert.equal(saveMatchRecovery(input,blocked,now),false); assert.equal(loadMatchRecovery(owner,blocked,now),null)
  assert.doesNotThrow(()=>clearMatchRecovery(owner,blocked));assert.deepEqual(input,before)
})
test('only allowed match fields are serialized; unrelated tokens cannot leak into snapshots', () => {
  const s=store(),value=snapshot();value.token='never-copy';value.owner.password='never-copy';value.draft.teamCode='never-copy';value.draft.participants[0].secret='never-copy'
  assert.equal(saveMatchRecovery(value,s,now),true);assert.equal(s.getItem(s.key(0)).includes('never-copy'),false)
})

test('quarter checkpoint response loss preserves the exact retry and target quarter', () => {
  for (let quarter = 1; quarter <= 4; quarter++) {
    const s = store(), value = snapshot()
    value.step = 3; value.quarter = quarter
    value.pending = {key:'00000000-0000-4000-8000-000000000001',draft:structuredClone(value.draft),record:null,destination:`quarter-${quarter}`}
    assert.equal(saveMatchRecovery(value,s,now),true)
    const restored = loadMatchRecovery(owner,s,now)
    assert.equal(restored.quarter,quarter)
    assert.equal(restored.pending.destination,`quarter-${quarter}`)
    assert.deepEqual(toMatchPayload(restored.pending.draft,null),toMatchPayload(value.pending.draft,null))
  }
})

test('quarter conceded survives recovery and frozen retries, omission remains absent', () => {
  for (const fields of [{}, {goalsAgainst:0,goalsAgainstSpecified:true}, {goalsAgainst:2}, {goalsAgainst:null,goalsAgainstSpecified:true}]) {
    const s=store(), value=snapshot();Object.assign(value.draft.quarters[0],fields)
    value.pending={key:'00000000-0000-4000-8000-000000000001',draft:structuredClone(value.draft),record:null,destination:'quarter-1'}
    const body=JSON.stringify(toMatchPayload(value.pending.draft,null))
    assert.equal(saveMatchRecovery(value,s,now),true)
    const restored=loadMatchRecovery(owner,s,now)
    assert.deepEqual(restored.draft.quarters,value.draft.quarters)
    assert.deepEqual(JSON.parse(JSON.stringify(toMatchPayload(restored.pending.draft,null))),JSON.parse(body))
  }
})
