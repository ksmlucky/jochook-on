import test from 'node:test'
import assert from 'node:assert/strict'
import { updateQuarterResult } from '../src/features/matches/quarterScores.ts'
import { editSquad, squadEntries } from '../src/features/matches/unifiedSquad.ts'
import { placeInPlan } from '../src/features/matches/plan.ts'
import { changeMatchFormat } from '../src/features/matches/matchFormat.ts'
import { matchHistoryChanges } from '../src/features/matches/historyChanges.ts'
const a=(id,slot='ST',entryOrder=0,goals=0,team='A')=>({playerId:id,slot,entryOrder,team,goals,assists:0})
const d=()=>({kind:'EXTERNAL',matchFormat:'FOUR_QUARTERS',scoreFor:null,scoreAgainst:null,plannedLineup:[],participants:[1,2,3].map(playerId=>({playerId,vote:'ATTENDING',attendance:'PRESENT'})),quarters:[1,2,3,4].map(number=>({number,lineup:[]}))})
test('starter removal promotes substitute, preserves their goals and protects the removed scorer',()=>{
 const draft=d();draft.quarters[0].lineup=[a(1),a(2,'ST',1,2)]
 const next=editSquad(draft,1,'A','ST',0,null)
 assert.deepEqual(next.quarters[0].lineup,[a(2,'ST',0,2)])
 assert.equal(draft.quarters[0].lineup.length,2)
 assert.throws(()=>editSquad(next,1,'A','ST',0,null),/기록/)
})
test('drag to empty slot promotes source substitute; populated destination swaps just the players',()=>{
 const draft=d();draft.quarters[0].lineup=[a(1),a(2,'ST',1),a(3,'LW')]
 const moved=placeInPlan(squadEntries(draft),1,'RW',0,1)
 assert.equal(moved.find(a=>a.playerId===2).entryOrder,0)
 const swapped=editSquad(draft,1,'A','LW',0,{playerId:1})
 assert.equal(swapped.quarters[0].lineup.find(a=>a.playerId===3).slot,'ST')
 assert.equal(swapped.quarters[0].lineup.find(a=>a.playerId===2).entryOrder,1)
 const subSwap=editSquad(draft,1,'A','ST',1,{playerId:3})
 assert.equal(subSwap.quarters[0].lineup.find(a=>a.playerId===2).slot,'LW')
})
test('quarter goals and conceded update paired final score, amendments and deletions reduce totals',()=>{
 let draft=d();draft.quarters[0].lineup=[a(1)]
 draft=updateQuarterResult(draft,{...draft.quarters[0],lineup:[a(1,'ST',0,2)]})
 assert.deepEqual([draft.scoreFor,draft.scoreAgainst],[2,0])
 draft=updateQuarterResult(draft,{...draft.quarters[1],goalsAgainst:3,goalsAgainstSpecified:true})
 assert.deepEqual([draft.scoreFor,draft.scoreAgainst],[2,3])
 draft=updateQuarterResult(draft,{...draft.quarters[0],lineup:[a(1)]})
 draft=updateQuarterResult(draft,{...draft.quarters[1],goalsAgainst:0,goalsAgainstSpecified:true})
 assert.deepEqual([draft.scoreFor,draft.scoreAgainst],[0,0])
})
test('assists-only edits preserve legacy scores; conceded does not erase manually recorded goals',()=>{
 let draft={...d(),scoreFor:5,scoreAgainst:2};draft.quarters[0].lineup=[a(1)]
 draft=updateQuarterResult(draft,{...draft.quarters[0],lineup:[{...a(1),assists:1}]})
 assert.deepEqual([draft.scoreFor,draft.scoreAgainst],[5,2])
 draft=updateQuarterResult(draft,{...draft.quarters[0],goalsAgainst:0,goalsAgainstSpecified:true})
 assert.deepEqual([draft.scoreFor,draft.scoreAgainst],[5,0])
})
test('internal score derives A and B separately, two halves sum only those periods',()=>{
 let draft={...d(),kind:'INTERNAL'}
 draft=updateQuarterResult(draft,{number:1,lineup:[a(1,'ST',0,2),a(2,'ST',0,3,'B')]})
 assert.deepEqual([draft.scoreFor,draft.scoreAgainst],[2,3])
 let halves={...d(),matchFormat:'TWO_HALVES_30',quarters:d().quarters.slice(0,2)}
 halves=updateQuarterResult(halves,{number:2,lineup:[a(1,'ST',0,1)],goalsAgainst:2,goalsAgainstSpecified:true})
 assert.deepEqual([halves.scoreFor,halves.scoreAgainst],[1,2])
})
test('conceded-only late quarters block shortening and history includes zero vs unknown',()=>{
 const draft=d();draft.quarters[3].goalsAgainst=0
 assert.throws(()=>changeMatchFormat(draft,'TWO_HALVES_30'),/3·4쿼터/)
 const changes=matchHistoryChanges(d(),draft)
 assert.ok(changes.some(c=>c.label==='4쿼터 · 실점'&&c.before==='—'&&c.after==='0'))
})
