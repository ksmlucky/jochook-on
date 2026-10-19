import test from 'node:test'
import assert from 'node:assert/strict'
import { quarterHighlights } from '../src/features/matches/quarterHighlights.ts'
const player=(playerId,name,shirtNumber)=>({playerId,name,shirtNumber})
const record=()=>({kind:'EXTERNAL',matchFormat:'TWO_HALVES_30',participants:[player(1,'예시가',9),player(2,'예시나',null)],quarters:[{number:1,lineup:[{team:'A',playerId:1,goals:1,assists:0},{team:'A',playerId:2,goals:0,assists:1}],goalEvents:[{team:'A',scorerId:1,assistId:2,type:'NORMAL'}],goalsAgainst:2},{number:2,lineup:[],goalEvents:[],goalsAgainst:0}]})
test('halves preserve each scorer-assist link and distinguish zero from missing conceded',()=>{
 const r=record(), result=quarterHighlights(r)
 assert.deepEqual(result.map(q=>q.label),['전반(1쿼터)','후반(2쿼터)'])
 assert.deepEqual(result[0].teams[0].lines,['#9 예시가 골 · 예시나 도움'])
 assert.equal(result[0].teams[0].conceded,2)
 assert.equal(result[1].teams[0].conceded,0)
 delete r.quarters[1].goalsAgainst
 assert.equal(quarterHighlights(r)[1].teams[0].conceded,null)
})
test('legacy aggregates never invent an assist pairing, repeated goals stay separate',()=>{
 const r=record();delete r.quarters[0].goalEvents
 assert.deepEqual(quarterHighlights(r)[0].teams[0].lines,['#9 예시가 · 1골','예시나 · 1도움'])
 assert.equal(quarterHighlights(r)[0].teams[0].unlinked,true)
 r.quarters[0].goalEvents=[{team:'A',scorerId:1,assistId:null,type:'FREE_KICK'},{team:'A',scorerId:1,assistId:null,type:'PENALTY'}]
 assert.deepEqual(quarterHighlights(r)[0].teams[0].lines,['#9 예시가 골 (프리킥)','#9 예시가 골 (페널티킥)'])
})
test('four quarters and internal teams keep separate records and derive opponent concessions',()=>{
 const r=record();r.kind='INTERNAL';r.matchFormat='FOUR_QUARTERS'
 r.quarters[0].lineup.push({team:'B',playerId:3,goals:2,assists:0})
 r.quarters[0].goalEvents.push({team:'B',scorerId:3,assistId:null,type:'NORMAL'})
 r.quarters.push({number:4,lineup:[]},{number:3,lineup:[]})
 const result=quarterHighlights(r)
 assert.deepEqual(result.map(q=>q.label),['1쿼터','2쿼터','3쿼터','4쿼터'])
 assert.equal(result[0].teams[0].conceded,2)
 assert.equal(result[0].teams[1].conceded,1)
 assert.deepEqual(result[0].teams[1].lines,['선수 확인 필요 골'])
 assert.equal(r.quarters[2].number,4)
})
