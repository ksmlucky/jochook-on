import test from 'node:test'
import assert from 'node:assert/strict'
import { withGoalEvents, seedGoalEvents, conversionMismatch } from '../src/features/matches/goalEvents.ts'
import { applySquad, editSquad, squadEntries } from '../src/features/matches/unifiedSquad.ts'
import { workbookQuarters } from '../src/features/matches/workbookApply.ts'
import { saveMatchRecovery, loadMatchRecovery } from '../src/features/matches/draftRecovery.ts'
import { toMatchPayload } from '../src/features/matches/matchPayload.ts'
import { matchHistoryChanges } from '../src/features/matches/historyChanges.ts'
const a = (id, slot, team='A') => ({ playerId:id,slot,team,entryOrder:0,goals:0,assists:0 })
const quarter = () => ({number:1,lineup:[a(1,'ST'),a(2,'LW'),a(3,'RW'),a(4,'ST','B')]})
const goal = (patch={}) => ({scorerId:1,assistId:2,type:'NORMAL',team:'A',...patch})
const draft = q => ({kind:'INTERNAL',playedOn:'2026-10-19',kickoff:'11:00',venue:'',opponent:'',notes:'',scoreFor:null,scoreAgainst:null,
  formationA:'F4123',formationB:'F4123',recordingStage:'PLAN',plannedLineup:[],quarters:[q,...[2,3,4].map(number=>({number,lineup:[]}))],
  participants:q.lineup.map(a=>({playerId:a.playerId,name:`예시 ${a.playerId}`,shirtNumber:a.playerId,birthYear:1996,vote:'ATTENDING',attendance:'PRESENT',playerType:'MEMBER',plannedTeam:a.team}))})
test('add/update/delete events derives totals, FK/PK and never double counts prefilled totals',()=>{
 const q=quarter(), original=structuredClone(q)
 const linked=withGoalEvents(q,[goal(),goal({assistId:null,type:'PENALTY'}),goal({scorerId:4,assistId:null,team:'B',type:'FREE_KICK'})])
 assert.equal(linked.lineup[0].goals,2);assert.equal(linked.lineup[1].assists,1)
 assert.equal(linked.lineup[0].penaltyGoals,1);assert.equal(linked.lineup[3].freeKickGoals,1)
 assert.deepEqual(withGoalEvents(linked,linked.goalEvents),linked)
 const edited=withGoalEvents(linked,[goal({assistId:3})]);assert.equal(edited.lineup[1].assists,0);assert.equal(edited.lineup[2].assists,1)
 assert.ok(withGoalEvents(edited,[]).lineup.every(a=>a.goals===0&&a.assists===0))
 assert.deepEqual(q,original)
})
test('rejects self assist, cross team, missing player and direct FK/PK assists',()=>{
 for(const patch of [{assistId:1},{assistId:4},{scorerId:99},{type:'FREE_KICK'},{type:'PENALTY'}]) assert.throws(()=>withGoalEvents(quarter(),[goal(patch)]))
})
test('legacy conversion preserves totals, does not infer an assisting player',()=>{
 const q=withGoalEvents(quarter(),[goal(),goal({assistId:null,type:'FREE_KICK'})]);delete q.goalEvents
 const seeded=seedGoalEvents(q);assert.ok(seeded.every(e=>e.assistId===null));assert.ok(conversionMismatch(q,seeded))
 const normal=seeded.find(e=>e.type==='NORMAL');normal.assistId=2
 assert.equal(conversionMismatch(q,seeded),null)
})
test('slot swaps keep goal associations; removal/manual totals and workbook overwrite are blocked',()=>{
 const d=draft(withGoalEvents(quarter(),[goal()]))
 const swapped=editSquad(d,1,'A','LW',0,{playerId:1});assert.equal(swapped.quarters[0].lineup.find(a=>a.playerId===1).slot,'LW')
 assert.deepEqual(swapped.quarters[0].goalEvents,d.quarters[0].goalEvents)
 assert.throws(()=>applySquad(d,squadEntries(d).filter(e=>e.playerId!==2)))
 assert.throws(()=>editSquad(d,1,'A','ST',0,{goals:7}))
 assert.throws(()=>workbookQuarters(d.quarters,[],'A'))
})
test('tab recovery and frozen retry preserve linked events, omitted legacy key stays omitted',()=>{
 const m=new Map(),storage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i]??null,get length(){return m.size}}
 const owner={username:'example',teamId:1},now=Date.now(),d=draft(withGoalEvents(quarter(),[goal()]))
 const snapshot={schema:1,owner,savedAt:now,record:null,draft:d,kickoffHour:'11',kickoffMinute:'00',step:1,quarter:1,team:'A',pending:{key:'00000000-0000-4000-8000-000000000001',draft:d,record:null,destination:'save'}}
 assert.equal(saveMatchRecovery(snapshot,storage,now),true)
 const restored=loadMatchRecovery(owner,storage,now)
 assert.deepEqual(restored.draft.quarters[0].goalEvents,d.quarters[0].goalEvents)
 assert.deepEqual(toMatchPayload(restored.pending.draft,null),toMatchPayload(d,null))
 assert.equal(Object.hasOwn(restored.draft.quarters[1],'goalEvents'),false)
})
test('history shows assist relationship changes even when goal totals remain the same',()=>{
 const before={...draft(withGoalEvents(quarter(),[goal()])),id:1,version:1},after={...draft(withGoalEvents(quarter(),[goal({assistId:3})])),id:1,version:2}
 assert.ok(matchHistoryChanges(before,after).some(c=>c.label.includes('득점·도움 연결')&&c.before.includes('예시 2')&&c.after.includes('예시 3')))
})
