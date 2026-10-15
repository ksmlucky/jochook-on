import type { MatchDraft, MatchTeam } from './api'
import type { Position, PreferredPosition } from '../players/api'

export const slots = ['GK', 'LB', 'LCB', 'RCB', 'RB', 'CDM', 'LCM', 'RCM', 'LW', 'ST', 'RW', 'LM', 'RM', 'CAM', 'LCDM', 'RCDM', 'LST', 'RST', 'CCB', 'LWB', 'RWB'] as const
export type Slot = typeof slots[number]
export const slotLabels: Record<Slot, string> = {
  GK: 'GK', LB: 'LB', LCB: 'LCB', RCB: 'RCB', RB: 'RB', CDM: 'CDM', LCM: 'CM (좌)', RCM: 'CM (우)', LW: 'LW', ST: 'ST', RW: 'RW',
  LM: 'LM', RM: 'RM', CAM: 'CAM', LCDM: 'CDM (좌)', RCDM: 'CDM (우)', LST: 'ST (좌)', RST: 'ST (우)',
  CCB: 'CB', LWB: 'LWB', RWB: 'RWB',
}
export const formations = {
  F4123: { label: '4-1-2-3', description: '수비형 미드필더 1명과 측면 공격수 2명을 두는 기존 구성', rows: [['LW', 'ST', 'RW'], ['LCM', 'RCM'], ['CDM'], ['LB', 'LCB', 'RCB', 'RB'], ['GK']] },
  F442: { label: '4-4-2', description: '두 줄의 수비·미드필더와 공격수 2명으로 역할을 나누는 구성', rows: [['LST', 'RST'], ['LM', 'LCM', 'RCM', 'RM'], ['LB', 'LCB', 'RCB', 'RB'], ['GK']] },
  F4231: { label: '4-2-3-1', description: '수비형 미드필더 2명과 공격형 미드필더 1명으로 중앙을 채우는 구성', rows: [['ST'], ['LM', 'CAM', 'RM'], ['LCDM', 'RCDM'], ['LB', 'LCB', 'RCB', 'RB'], ['GK']] },
  F4141: { label: '4-1-4-1', description: '수비형 미드필더의 뒷받침과 미드필더 4명의 간격을 활용하는 구성', rows: [['ST'], ['LM', 'LCM', 'RCM', 'RM'], ['CDM'], ['LB', 'LCB', 'RCB', 'RB'], ['GK']] },
  F352: { label: '3-5-2', description: '수비 3명·양쪽 윙백·중앙 미드필더 2명·공격형 미드필더 1명·공격수 2명 구성', rows: [['LST', 'RST'], ['CAM'], ['LWB', 'LCM', 'RCM', 'RWB'], ['LCB', 'CCB', 'RCB'], ['GK']] },
  F343: { label: '3-4-3', description: '수비 3명·LM/RM과 중앙 미드필더 2명·공격수 3명 구성', rows: [['LW', 'ST', 'RW'], ['LM', 'LCM', 'RCM', 'RM'], ['LCB', 'CCB', 'RCB'], ['GK']] },
} satisfies Record<string, { label: string; description: string; rows: Slot[][] }>
export type Formation = keyof typeof formations
export const formationOptions = Object.keys(formations) as Formation[]
export const normalizeFormation = (value?: Formation | null): Formation => value && Object.hasOwn(formations, value) ? value : 'F4123'
export const formationFor = (match: { formationA?: Formation | null; formationB?: Formation | null }, team: MatchTeam = 'A') => normalizeFormation(team === 'A' ? match.formationA : match.formationB)
export const pitchRowsFor = (formation?: Formation | null): Slot[][] => formations[normalizeFormation(formation)].rows
export const formationLabel = (formation?: Formation | null) => formations[normalizeFormation(formation)].label
export function slotPosition(slot: Slot): PreferredPosition {
  if (slot === 'LCB' || slot === 'CCB' || slot === 'RCB') return 'CB'
  if (slot === 'LCM' || slot === 'RCM') return 'CM'
  if (slot === 'LCDM' || slot === 'RCDM') return 'CDM'
  if (slot === 'LST' || slot === 'RST') return 'ST'
  return slot
}
export function slotGroup(slot: Slot): Position {
  const position = slotPosition(slot)
  if (position === 'GK') return 'GK'
  if (['LB', 'CB', 'RB', 'LWB', 'RWB'].includes(position)) return 'DF'
  if (['CDM', 'CM', 'LM', 'RM', 'CAM'].includes(position)) return 'MF'
  return 'FW'
}
export function removedPlanCount(draft: MatchDraft, team: MatchTeam, next: Formation): number {
  const allowed = new Set<Slot>(pitchRowsFor(next).flat())
  return draft.plannedLineup.filter(entry => entry.team === team && !allowed.has(entry.slot)).length
}
/** Actual records must be explicitly removed by the operator; changing shape never deletes stats. */
export function changeFormation(draft: MatchDraft, team: MatchTeam, next: Formation): MatchDraft {
  if (formationFor(draft, team) === next) return draft
  if (draft.quarters.some(quarter => quarter.lineup.some(entry => entry.team === team))) {
    throw new Error('실제 출전 기록이 있는 팀은 포메이션을 변경할 수 없습니다. 03에서 기존 출전·골·도움을 확인하고 직접 배치를 해제한 뒤 변경해 주세요.')
  }
  const allowed = new Set<Slot>(pitchRowsFor(next).flat())
  return { ...draft, [team === 'A' ? 'formationA' : 'formationB']: next,
    plannedLineup: draft.plannedLineup.filter(entry => entry.team !== team || allowed.has(entry.slot)) }
}
