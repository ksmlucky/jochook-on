import test from 'node:test'
import assert from 'node:assert/strict'
import { currentDraftSlot, legacyDraftEntries, upgradeEditableMatchDraft } from '../src/features/matches/legacyMatchDraft.ts'
import { toMatchPayload } from '../src/features/matches/matchPayload.ts'

const fixture = () => ({ kind:'INTERNAL',formationA:'F352',formationB:'F343',playedOn:'2026-10-15',kickoff:'11:00',venue:'',opponent:'',notes:'',scoreFor:2,scoreAgainst:1,
  participants:[{playerId:1,name:'가상 선수',shirtNumber:1,birthYear:1990,playerType:'MEMBER',vote:'ATTENDING',attendance:'PRESENT'}],
  plannedLineup:[{quarterNumber:1,team:'A',slot:'CDM',entryOrder:0,playerId:1}],
  quarters:[1,2,3,4].map(number=>({number,lineup:number===1?[{team:'B',slot:'LWB',entryOrder:0,playerId:1,goals:2,assists:1,freeKickGoals:1,penaltyGoals:1}]:[]})) })

test('editable recovered three-back drafts map previous roles while retaining scores and identities', () => {
  const original=fixture(), before=structuredClone(original), next=upgradeEditableMatchDraft(original)
  assert.equal(next.plannedLineup[0].slot,'CAM')
  assert.deepEqual(next.quarters[0].lineup[0],{...original.quarters[0].lineup[0],slot:'LM'})
  assert.equal(next.participants[0].plannedTeam,'A')
  assert.deepEqual(original,before)
  assert.deepEqual(legacyDraftEntries(next),[])
  assert.equal(legacyDraftEntries(original).length,2)
})

test('legacy slot conversion is scoped to each selected formation and repeated conversion is stable', () => {
  const draft=fixture()
  assert.equal(currentDraftSlot(draft,'A','CDM'),'CAM')
  assert.equal(currentDraftSlot(draft,'B','RWB'),'RM')
  assert.equal(currentDraftSlot(draft,'A','LWB'),'LWB')
  assert.equal(currentDraftSlot(draft,'B','CDM'),'CDM')
  assert.equal(currentDraftSlot({...draft,formationA:'F4123'},'A','CDM'),'CDM')
  assert.deepEqual(upgradeEditableMatchDraft(upgradeEditableMatchDraft(draft)),upgradeEditableMatchDraft(draft))
})

test('read-only legacy summary and editable conversion never change a frozen pending retry payload', () => {
  const pending=fixture(), body=JSON.stringify(toMatchPayload(pending,null))
  const editable=upgradeEditableMatchDraft(pending)
  legacyDraftEntries(pending)
  assert.equal(JSON.stringify(toMatchPayload(pending,null)),body)
  assert.equal('plannedTeam' in pending.participants[0],false)
  assert.equal(editable.participants[0].plannedTeam,'A')
  assert.notEqual(JSON.stringify(toMatchPayload(editable,null)),body)
})
