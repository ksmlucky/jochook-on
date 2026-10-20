import test from 'node:test'
import assert from 'node:assert/strict'
import { validScoringOrder, scoringOrderCandidates, moveScoringEvent } from '../src/features/matches/scoringOrder.ts'
import { withGoalEvents } from '../src/features/matches/goalEvents.ts'
import { updateQuarterResult } from '../src/features/matches/quarterScores.ts'
import { saveMatchRecovery, loadMatchRecovery } from '../src/features/matches/draftRecovery.ts'
import { toMatchPayload } from '../src/features/matches/matchPayload.ts'
import { matchHistoryChanges } from '../src/features/matches/historyChanges.ts'

const q = () => ({ number: 1, lineup: [1, 2].map((playerId, i) => ({ playerId, slot: i ? 'LW' : 'ST', team: 'A', entryOrder: 0, goals: 1, assists: 0 })),
  goalEvents: [1, 2].map(scorerId => ({ scorerId, assistId: null, type: 'NORMAL', team: 'A' })), goalsAgainst: 1, scoringOrder: [0, -1, 1] })
const draft = quarter => ({ kind:'EXTERNAL', playedOn:'2026-10-19', kickoff:'11:00', venue:'', opponent:'', notes:'', scoreFor:2, scoreAgainst:1,
  formationA:'F4123', formationB:'F4123', recordingStage:'RESULT', plannedLineup:[], quarters:[quarter, ...[2,3,4].map(number=>({number,lineup:[]}))],
  participants:[1,2].map(playerId=>({playerId,name:`예시 ${playerId}`,shirtNumber:playerId,birthYear:1996,vote:'ATTENDING',attendance:'PRESENT',playerType:'MEMBER'})) })

test('only full unique scored/conceded sequences are known; unknown differs from zero', () => {
  assert.equal(validScoringOrder(q(), false), true)
  for (const scoringOrder of [null, [], [0,0,-1], [0,1], [0,-1,1,-1], [0,-1,2], [0,1,null], [0,-2,1]])
    assert.equal(validScoringOrder({...q(),scoringOrder}, false), false)
  assert.equal(validScoringOrder({...q(),goalsAgainst:null}, false), false)
  assert.equal(validScoringOrder({...q(),goalEvents:null}, false), false)
  assert.equal(validScoringOrder({...q(),goalEvents:[],goalsAgainst:0,scoringOrder:[]}, false), true)
  assert.equal(validScoringOrder({...q(),goalEvents:[...q().goalEvents,{scorerId:3,assistId:null,type:'NORMAL',team:'B'}],scoringOrder:[2,0,1]}, true), true)
  assert.equal(validScoringOrder(q(), true), false)
})

test('proposed candidates never mutate or confirm legacy history; movement keeps every event', () => {
  const quarter = {...q(),scoringOrder:null}, copy=structuredClone(quarter)
  assert.deepEqual(scoringOrderCandidates(quarter,false),[0,1,-1])
  assert.deepEqual(quarter,copy)
  const initial=[0,1,-1], moved=moveScoringEvent(initial,2,-1)
  assert.deepEqual(moved,[0,-1,1]); assert.deepEqual(initial,[0,1,-1])
  assert.deepEqual(moveScoringEvent(moved,0,-1),moved)
  assert.deepEqual(scoringOrderCandidates(quarter,true),[0,1])
})

test('new/edited/deleted goals and conceded changes clear known timeline but not player stats', () => {
  const original=q(), changed=[...original.goalEvents,{...original.goalEvents[0]}]
  const edited=withGoalEvents(original,changed)
  assert.equal(edited.scoringOrder,null);assert.equal(edited.scoringOrderSpecified,true)
  assert.deepEqual(edited.lineup.map(a=>a.goals),[2,1])
  for(const events of [original.goalEvents.slice(0,1),[original.goalEvents[1],original.goalEvents[0]],original.goalEvents.map((g,i)=>i?g:{...g,assistId:2})])
    assert.equal(withGoalEvents(original,events).scoringOrder,null)
  assert.deepEqual(withGoalEvents(original,original.goalEvents).scoringOrder,[0,-1,1])
  const d=draft(original), changedScore=updateQuarterResult(d,{...original,goalsAgainst:2,goalsAgainstSpecified:true})
  assert.equal(changedScore.quarters[0].scoringOrder,null);assert.equal(changedScore.quarters[0].scoringOrderSpecified,true)
  assert.equal(changedScore.scoreAgainst,2)
  assert.deepEqual(d.quarters[0].scoringOrder,[0,-1,1])
})

test('explicit confirmation of zero-goal legacy period works and does not alter final score', () => {
  const quarter={number:1,lineup:[],goalsAgainst:2}, d=draft(quarter)
  const confirmed={...withGoalEvents(quarter,[]),scoringOrder:[-1,-1],scoringOrderSpecified:true}
  const result=updateQuarterResult(d,confirmed)
  assert.deepEqual(result.quarters[0].scoringOrder,[-1,-1])
  assert.equal(validScoringOrder(result.quarters[0],false),true)
  assert.deepEqual([result.scoreFor,result.scoreAgainst],[2,1])
})

test('tab recovery, pending frozen retry and payload retain chronology and explicit unknown', () => {
  const m=new Map(), storage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i]??null,get length(){return m.size}}
  const owner={username:'example',teamId:1},now=Date.now(),d=draft({...q(),scoringOrderSpecified:true})
  d.quarters[1]={...d.quarters[1],scoringOrder:null,scoringOrderSpecified:true}
  const snapshot={schema:1,owner,savedAt:now,record:null,draft:d,kickoffHour:'11',kickoffMinute:'00',step:2,quarter:1,team:'A',pending:{key:'00000000-0000-4000-8000-000000000001',draft:d,record:null,destination:'save'}}
  assert.equal(saveMatchRecovery(snapshot,storage,now),true)
  const restored=loadMatchRecovery(owner,storage,now)
  assert.deepEqual(restored.draft.quarters[0].scoringOrder,[0,-1,1])
  assert.equal(restored.draft.quarters[1].scoringOrder,null);assert.equal(restored.draft.quarters[1].scoringOrderSpecified,true)
  assert.equal(Object.hasOwn(restored.draft.quarters[2],'scoringOrder'),false)
  assert.deepEqual(toMatchPayload(restored.pending.draft,null),toMatchPayload(d,null))
  const invalid=structuredClone(snapshot); invalid.draft.quarters[0].scoringOrder=[0,-1,0]
  assert.equal(saveMatchRecovery(invalid,storage,now),false)
})

test('history shows sequence-only edit and unknown clear without invented timestamps', () => {
  const before={...draft(q()),id:1,version:0},after={...draft({...q(),scoringOrder:[-1,0,1]}),id:1,version:1}
  const change=matchHistoryChanges(before,after).find(c=>c.label.includes('득실점 순서'))
  assert.ok(change);assert.ok(change.before.startsWith('1. A팀'));assert.ok(change.after.startsWith('1. 상대 팀'))
  const cleared=matchHistoryChanges(after,{...after,quarters:after.quarters.map(q=>({...q,scoringOrder:null}))}).find(c=>c.label.includes('득실점 순서'))
  assert.equal(cleared.after,'순서 미확인')
})

test('history distinguishes the same scorer goals when types or assists differ in chronological order',()=>{
 const quarter=q();quarter.goalEvents=[{...quarter.goalEvents[0],assistId:2},{...quarter.goalEvents[0],type:'PENALTY'}]
 const before={...draft(quarter),id:1,version:0},after={...draft({...quarter,scoringOrder:[1,-1,0]}),id:1,version:1}
 const change=matchHistoryChanges(before,after).find(c=>c.label.includes('득실점 순서'))
 assert.ok(change);assert.ok(change.before.includes('일반 득점'));assert.ok(change.after.startsWith('1. A팀 #1 예시 1 골 (페널티킥)'))
})
