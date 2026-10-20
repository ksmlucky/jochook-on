import test from 'node:test'
import assert from 'node:assert/strict'
import { reportTimeline, reportScoreDifference, legacyQuarterTotals } from '../src/features/matches/reportTimeline.ts'
const event=(team='A')=>({team,scorerId:1,assistId:null,type:'NORMAL'})
const q=(number,goalEvents,scoringOrder,goalsAgainst=0)=>({number,lineup:[],goalEvents,scoringOrder,goalsAgainst})

test('manual final score mismatch hides all running scores, including an otherwise known first period',()=>{
 const match={kind:'EXTERNAL',scoreFor:3,scoreAgainst:1,quarters:[q(1,[event()],[0,-1],1),q(2,[event()],[0],0)]}
 assert.deepEqual(reportScoreDifference(match),{recordedFor:2,recordedAgainst:1})
 assert.ok(reportTimeline(match).every(row=>row.entries.every(entry=>entry.score===null)))
 assert.equal(reportTimeline({...match,scoreFor:2})[0].entries[0].score,'1 : 0')
 const partial={...match,quarters:[match.quarters[0],q(2,[event()],null,0)]}
 assert.equal(reportTimeline(partial)[0].entries[0].score,null)
 assert.equal(reportScoreDifference({...match,scoreFor:null}),null)
 assert.equal(reportScoreDifference({...match,quarters:[q(1,[event()],[0],null)]}),null)
})

test('internal final score difference counts both teams and legacy aggregate goals',()=>{
 const match={kind:'INTERNAL',scoreFor:1,scoreAgainst:2,quarters:[q(1,[event('A'),event('B')],[0,1],null)]}
 assert.deepEqual(reportScoreDifference(match),{recordedFor:1,recordedAgainst:1})
 const legacy={...match,quarters:[{number:1,lineup:[{playerId:1,team:'A',goals:1,assists:0},{playerId:2,team:'B',goals:2,assists:0}],scoringOrder:null}]}
 assert.equal(reportScoreDifference(legacy),null)
})

test('legacy summary retains assist-only players and FK/PK counts without inventing pairings',()=>{
 const scorer={playerId:1,team:'A',goals:3,assists:0,freeKickGoals:1,penaltyGoals:1}
 const helper={playerId:2,team:'A',goals:0,assists:1,freeKickGoals:0,penaltyGoals:0}
 const noStats={playerId:3,team:'A',goals:0,assists:0}
 const quarter={number:1,lineup:[scorer,helper,noStats],goalEvents:null,scoringOrder:null}
 assert.deepEqual(legacyQuarterTotals(quarter),[scorer,helper])
 assert.equal(reportTimeline({kind:'EXTERNAL',quarters:[quarter]})[0].known,false)
})
