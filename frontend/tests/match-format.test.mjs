import test from 'node:test'
import assert from 'node:assert/strict'
import { changeMatchFormat, matchFormatLabel, matchPeriodSummary, normalizeMatchFormat, quarterLabel, quarterNumbers, validateMatchPeriods } from '../src/features/matches/matchFormat.ts'
import { matchTimeRange } from '../src/features/matches/time.ts'
import { toMatchPayload } from '../src/features/matches/matchPayload.ts'
import { actualFromPlan } from '../src/features/matches/plan.ts'
import { analyzeCompletion } from '../src/features/matches/completionReview.ts'
import { generateMatchPlan } from '../src/features/matches/automaticPlan.ts'
import { workbookQuarters } from '../src/features/matches/workbookApply.ts'

const FOUR = 'FOUR_QUARTERS', TWO = 'TWO_HALVES_30'
const entry = (playerId = 1, quarterNumber = 1, entryOrder = 0) => ({playerId,quarterNumber,entryOrder,team:'A',slot:'ST'})
const draft = () => ({kind:'EXTERNAL',playedOn:'2026-10-15',kickoff:'11:00',venue:'',opponent:'가상 상대',notes:'',scoreFor:null,scoreAgainst:null,
  formationA:'F4123',formationB:'F4123',participants:[1,2].map(playerId=>({playerId,name:`가상 선수 ${playerId}`,shirtNumber:playerId,birthYear:1990,playerType:'MEMBER',vote:'ATTENDING',attendance:'UNCONFIRMED'})),
  quarters:[1,2,3,4].map(number=>({number,lineup:[]})),plannedLineup:[]})

test('legacy formats retain four quarters and tournament halves have explicit two-quarter labels',()=>{
  assert.equal(normalizeMatchFormat(undefined),FOUR)
  assert.deepEqual(quarterNumbers(),[1,2,3,4]);assert.deepEqual(quarterNumbers(TWO),[1,2])
  assert.equal(quarterLabel(1,TWO),'전반(1쿼터)');assert.equal(quarterLabel(2,TWO),'후반(2쿼터)')
  assert.equal(quarterLabel(3),'3쿼터');assert.equal(matchFormatLabel(TWO),'전·후반 각 30분')
  assert.equal(matchPeriodSummary(TWO),'전·후반')
})

test('changing to two halves preserves first/second-quarter players and FK/PK while expanding back creates only empty quarters',()=>{
  const source=draft();source.plannedLineup=[entry()]
  source.quarters[1].lineup=[{...entry(),goals:2,assists:1,freeKickGoals:1,penaltyGoals:1}]
  const before=structuredClone(source), half=changeMatchFormat(source,TWO)
  assert.deepEqual(half.quarters,source.quarters.slice(0,2));assert.deepEqual(half.plannedLineup,source.plannedLineup)
  const full=changeMatchFormat(half,FOUR)
  assert.deepEqual(full.quarters.slice(0,2),half.quarters)
  assert.deepEqual(full.quarters.slice(2),[{number:3,lineup:[]},{number:4,lineup:[]}])
  assert.deepEqual(source,before);assert.doesNotThrow(()=>validateMatchPeriods(half))
})

test('third/fourth-quarter plans or actual records including zero goals block shortening without any mutation',()=>{
  for(const [type,number] of [['plan',3],['plan',4],['actual',3],['actual',4]]){
    const source=draft()
    if(type==='plan')source.plannedLineup=[entry(1,number)]
    else source.quarters[number-1].lineup=[{...entry(),goals:0,assists:0}]
    const before=structuredClone(source)
    assert.throws(()=>changeMatchFormat(source,TWO),/3·4쿼터/)
    assert.deepEqual(source,before)
  }
  assert.throws(()=>changeMatchFormat({...draft(),kind:'INTERNAL'},TWO),/자체전/)
})

test('format-aware validation rejects duplicate, missing or out-of-range halves before saving/copying',()=>{
  const half=changeMatchFormat(draft(),TWO)
  assert.throws(()=>validateMatchPeriods({...half,quarters:[half.quarters[0],half.quarters[0]]}),/경기 형식/)
  assert.throws(()=>validateMatchPeriods({...half,quarters:[...half.quarters,{number:3,lineup:[]}]}),/경기 형식/)
  assert.throws(()=>validateMatchPeriods({...half,plannedLineup:[entry(1,3)]}),/경기 형식/)
  assert.throws(()=>validateMatchPeriods({...half,kind:'INTERNAL'}),/자체전/)
})

test('cleared third/fourth-quarter drafts must be saved separately before shortening an existing record',()=>{
  const saved=draft(), edited=draft()
  saved.quarters[2].lineup=[{...entry(),goals:0,assists:0}]
  const before=structuredClone(edited)
  assert.throws(()=>changeMatchFormat(edited,TWO,saved),/정리를 먼저 저장/)
  assert.deepEqual(edited,before)
  assert.doesNotThrow(()=>changeMatchFormat(edited,TWO,edited))
  assert.doesNotThrow(()=>changeMatchFormat(edited,FOUR,saved))
})

test('copying two-half plans and completion review only use two periods with no time conversion',()=>{
  const source=changeMatchFormat(draft(),TWO)
  source.plannedLineup=[entry(1),entry(2,1,1),entry(1,2)]
  const actual=actualFromPlan(source)
  assert.deepEqual(actual.quarters.map(q=>q.number),[1,2])
  assert.equal(actual.quarters[0].lineup.length,2)
  assert.equal(actual.quarters[1].lineup.length,1)
  assert.equal(analyzeCompletion(actual).quarters.length,2)
  assert.equal(analyzeCompletion(actual).attendeesWithoutAppearance.length,0)
})

test('one-hour half-time range excludes break and handles midnight while legacy ranges remain two hours',()=>{
  assert.equal(matchTimeRange('11:00',TWO),'11:00–12:00')
  assert.equal(matchTimeRange('23:30',TWO),'23:30–다음 날 00:30')
  assert.equal(matchTimeRange('11:00'),'11:00–13:00')
  assert.equal(matchTimeRange(null,TWO),'시간 미입력')
})

test('format payload omission is preserved for a frozen old retry; explicit half format is sent',()=>{
  const old=draft(), oldJson=JSON.stringify(toMatchPayload(old,null))
  assert.equal('matchFormat' in toMatchPayload(old,null),false)
  const half=changeMatchFormat(old,TWO)
  assert.equal(toMatchPayload(half,null).matchFormat,TWO)
  assert.equal(JSON.stringify(toMatchPayload(old,null)),oldJson)
})

test('two-half workbook imports reject late-quarter rows before they can be silently discarded',()=>{
  const source=changeMatchFormat(draft(),TWO)
  const before=structuredClone(source)
  assert.throws(()=>workbookQuarters(source.quarters,[{number:3,lineup:[]}],'A',TWO),/경기 형식/)
  assert.deepEqual(source,before)
  assert.deepEqual(workbookQuarters(source.quarters,[{number:1,lineup:[{...entry(),goals:1,assists:0}]}],'A',TWO).map(q=>q.number),[1,2])
})

test('automatic two-half planning passes the selected format and rejects a stale four-quarter response',async()=>{
  const source=changeMatchFormat(draft(),TWO)
  let seen
  const result=await generateMatchPlan(source,null,1,new AbortController().signal,async(...args)=>{
    seen=args;return {plannedLineup:[entry(1),entry(1,2)],allocations:[],warnings:[],optimal:true,policyVersion:'fixture',seed:1}
  })
  assert.equal(seen[6],TWO);assert.deepEqual(result.plannedLineup.map(e=>e.quarterNumber),[1,2])
  await assert.rejects(generateMatchPlan(source,null,1,new AbortController().signal,async()=>({plannedLineup:[entry(1,4)]})),/경기 형식/)
})
