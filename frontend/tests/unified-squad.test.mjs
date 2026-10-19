import test from 'node:test'
import assert from 'node:assert/strict'
import { unifiedDraft, squadPlanningView, squadEntries, applySquad, editSquad, updateSquadParticipant, applySquadTeamSelection } from '../src/features/matches/unifiedSquad.ts'
import { setInternalTeamSelection, assignPlannedTeam } from '../src/features/matches/internalTeams.ts'
import { stageOnSave, recordingStageLabel } from '../src/features/matches/recordingProgress.ts'
import { plannedShare } from '../src/features/matches/plan.ts'
import { toMatchPayload } from '../src/features/matches/matchPayload.ts'
const p = (id, extra={}) => ({playerId:id,name:`가상 선수 ${id}`,shirtNumber:id,birthYear:1996,playerType:'MEMBER',vote:'ATTENDING',attendance:'PRESENT',plannedTeam:null,...extra})
const a = (id,slot='ST',extra={}) => ({playerId:id,team:'A',slot,entryOrder:0,goals:0,assists:0,...extra})
const draft = (extra={}) => ({kind:'EXTERNAL',matchFormat:'FOUR_QUARTERS',playedOn:'2026-10-19',kickoff:'11:00',venue:'',opponent:'',scoreFor:null,scoreAgainst:null,notes:'',formationA:'F4123',formationB:'F4123',recordingStage:'PLAN',participants:[p(1),p(2),p(3)],plannedLineup:[],quarters:[1,2,3,4].map(number=>({number,lineup:[]})),...extra})
const withLineup = (lineup) => draft({quarters:[{number:1,lineup},...[2,3,4].map(number=>({number,lineup:[]}))]})
test('attendee selection records attendance and deselection promotes a substitute without mutating input',()=>{
 const d=withLineup([a(1),a(2,'ST',{entryOrder:1})]); const original=structuredClone(d)
 const result=updateSquadParticipant(d,1,{vote:'UNANSWERED'})
 assert.equal(result.participants[0].attendance,'UNCONFIRMED')
 assert.equal(result.quarters[0].lineup[0].playerId,2);assert.equal(result.quarters[0].lineup[0].entryOrder,0)
 const checked=updateSquadParticipant(result,1,{vote:'ATTENDING'});assert.equal(checked.participants[0].attendance,'PRESENT')
 assert.deepEqual(d,original)
})
test('old plan-only drafts migrate once, actual records win and completed plans do not become appearances',()=>{
 const old=draft({participants:[p(1,{attendance:'UNCONFIRMED'}),p(2,{attendance:'ABSENT'})],plannedLineup:[{quarterNumber:1,playerId:1,team:'A',slot:'ST',entryOrder:0}]})
 const migrated=unifiedDraft(old);assert.deepEqual(migrated.quarters[0].lineup,[a(1)]);assert.equal(migrated.participants[0].attendance,'PRESENT');assert.equal(migrated.participants[1].attendance,'ABSENT');assert.deepEqual(migrated.plannedLineup,[])
 assert.deepEqual(unifiedDraft(migrated),migrated);assert.equal(old.quarters[0].lineup.length,0)
 const actual={...old,quarters:withLineup([a(2,'GK',{goals:2})]).quarters};assert.deepEqual(unifiedDraft(actual).quarters,actual.quarters)
 const complete=unifiedDraft({...old,recordingStage:'COMPLETED'});assert.equal(complete.quarters[0].lineup.length,0);assert.equal(complete.participants[0].attendance,'UNCONFIRMED')
})
test('tap swaps move all stats with the players and preserve substitutes and other quarters',()=>{
 const d=withLineup([a(1,'ST',{goals:3,assists:1,freeKickGoals:1,penaltyGoals:1}),a(2,'GK',{goals:1}),a(3,'ST',{entryOrder:1})]);d.quarters[1].lineup=[a(1)]
 const result=editSquad(d,1,'A','GK',0,{playerId:1});const moved=result.quarters[0].lineup.find(e=>e.playerId===1)
 assert.equal(moved.slot,'GK');assert.equal(moved.goals,3);assert.equal(moved.assists,1);assert.equal(moved.freeKickGoals,1);assert.equal(moved.penaltyGoals,1)
 assert.deepEqual(result.quarters[0].lineup.find(e=>e.playerId===3),d.quarters[0].lineup[2]);assert.deepEqual(result.quarters[1],d.quarters[1])
 assert.equal(plannedShare(squadEntries(result),squadEntries(result).find(e=>e.playerId===3)),0.5)
 const edited=editSquad(result,1,'A','GK',0,{goals:4});assert.equal(edited.quarters[0].lineup.find(e=>e.playerId===1).goals,4)
 assert.equal(d.quarters[0].lineup[0].goals,3)
})
test('removing or replacing a scorer and invalid goal breakdown are blocked',()=>{
 const d=withLineup([a(1,'ST',{goals:2,penaltyGoals:1})])
 assert.throws(()=>editSquad(d,1,'A','ST',0,null),/기록/)
 assert.throws(()=>editSquad(d,1,'A','ST',0,{playerId:2}),/기록/)
 assert.throws(()=>updateSquadParticipant(d,1,{attendance:'ABSENT'}),/기록/)
 assert.throws(()=>applySquad(d,[]),/기록/)
 assert.throws(()=>editSquad(d,1,'A','ST',0,{goals:0}),/득점|골/)
})
test('two-period automatic allocations become canonical appearances and only explicit complete marks completion',()=>{
 const d=draft({matchFormat:'TWO_HALVES_30',quarters:[{number:1,lineup:[]},{number:2,lineup:[]}]})
 const next=applySquad(d,[{quarterNumber:1,playerId:1,team:'A',slot:'ST',entryOrder:0},{quarterNumber:2,playerId:2,team:'A',slot:'GK',entryOrder:0}])
 assert.equal(next.quarters[1].lineup[0].playerId,2);assert.equal(next.plannedLineup.length,0)
 assert.throws(()=>applySquad(d,[{quarterNumber:3,playerId:1,team:'A',slot:'ST',entryOrder:0}]),/구간/)
 const payload=toMatchPayload({...next,recordingStage:stageOnSave(1,'totals')});assert.equal(payload.recordingStage,'RESULT');assert.equal(payload.quarters[0].lineup[0].goals,0)
 assert.equal(stageOnSave(3,'complete'),'COMPLETED');assert.equal(recordingStageLabel('ACTUAL'),recordingStageLabel('PLAN'))
})
test('internal selection records attendance, changing teams clears only that player and cannot cross-assign',()=>{
 const d=draft({kind:'INTERNAL',participants:[p(1,{vote:'UNANSWERED',attendance:'UNCONFIRMED'}),p(2,{plannedTeam:'B'}),p(3,{plannedTeam:'A'})]})
 const selected=applySquadTeamSelection(d,setInternalTeamSelection(squadPlanningView(d),p(1),'A',true));assert.equal(selected.participants[0].attendance,'PRESENT')
 const placed=applySquad(selected,[{quarterNumber:1,playerId:1,team:'A',slot:'ST',entryOrder:0},{quarterNumber:1,playerId:2,team:'B',slot:'ST',entryOrder:0}])
 assert.throws(()=>editSquad(placed,1,'B','GK',0,{playerId:1}),/팀/)
 const moved=applySquadTeamSelection(placed,assignPlannedTeam(squadPlanningView(placed),1,'B'))
 assert.equal(moved.participants[0].plannedTeam,'B');assert.equal(moved.participants[0].attendance,'PRESENT');assert.equal(moved.quarters[0].lineup.length,1);assert.equal(moved.quarters[0].lineup[0].playerId,2)
})
