import test from 'node:test'
import assert from 'node:assert/strict'
import { reportTimeline, hasCompleteScoringOrder } from '../src/features/matches/reportTimeline.ts'
const event=(team='A')=>({team,scorerId:1,assistId:null,type:'NORMAL'})
const q=(number,goalEvents,scoringOrder,goalsAgainst=0)=>({number,lineup:[],goalEvents,scoringOrder,goalsAgainst})
test('report interleaves conceded goals and carries score between halves without inventing minutes',()=>{
 const rows=reportTimeline({kind:'EXTERNAL',quarters:[q(2,[event()],[-1,0],1),q(1,[event(),event()],[0,-1,1],1)]})
 assert.deepEqual(rows.flatMap(r=>r.entries.map(e=>e.score)),['1 : 0','1 : 1','2 : 1','2 : 2','3 : 2'])
 assert.equal(rows[0].entries[1].event,null)
})
test('legacy unknown order suppresses later running scores even if later period has an order',()=>{
 const rows=reportTimeline({kind:'EXTERNAL',quarters:[q(1,[event()],null,1),q(2,[event()],[0],0)]})
 assert.equal(rows[0].known,false)
 assert.deepEqual(rows[0].entries,[])
 assert.equal(rows[1].entries[0].score,null)
})
test('internal match timeline uses the goal team and rejects opponent sentinels',()=>{
 const rows=reportTimeline({kind:'INTERNAL',quarters:[q(1,[event('B'),event('A')],[0,1],null)]})
 assert.deepEqual(rows[0].entries.map(e=>e.score),['0 : 1','1 : 1'])
 assert.equal(hasCompleteScoringOrder(q(1,[event()],[0,-1],null),true),false)
})
test('missing, duplicate, fractional and out-of-range order indexes never create a timeline',()=>{
 for(const order of [[0,0],[0],[0,2],[0,0.5],[0,-2]])assert.equal(hasCompleteScoringOrder(q(1,[event(),event()],order),false),false)
 assert.equal(hasCompleteScoringOrder(q(1,[],[],null),false),false)
 assert.equal(hasCompleteScoringOrder(q(1,[],[],0),false),true)
})
