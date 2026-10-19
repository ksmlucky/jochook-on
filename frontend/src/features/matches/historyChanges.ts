import type { MatchRecord, Participant, Slot } from './api'
import { recordingStageLabel } from './recordingProgress.ts'
import { formationLabel } from './formations.ts'
import { tournamentStageLabels } from './tournamentFields.ts'
import { goalBreakdownText } from './goalBreakdown.ts'
import { matchFormatLabel, quarterLabel } from './matchFormat.ts'
import { goalTypeLabels } from './goalEvents.ts'

export interface HistoryChange { label: string; before: string; after: string }
const votes: Record<string, string> = { ATTENDING: '참석 예정', ABSENT: '불참 예정', UNDECIDED: '미정', UNANSWERED: '미투표' }
const attendance: Record<string, string> = { PRESENT: '참석', LATE: '지각', ABSENT: '불참', UNCONFIRMED: '미확인' }
const slotNames: Record<Slot, string> = { GK: 'GK', LB: 'LB', LCB: 'CB 좌', RCB: 'CB 우', RB: 'RB', CDM: 'CDM', LCM: 'CM 좌', RCM: 'CM 우', LW: 'LW', ST: 'ST', RW: 'RW', LM: 'LM', RM: 'RM', CAM: 'CAM', LCDM: 'CDM 좌', RCDM: 'CDM 우', LST: 'ST 좌', RST: 'ST 우', CCB: 'CB 중앙', LWB: 'LWB', RWB: 'RWB' }
const playerName = (p?: Participant) => p ? `${p.playerType === 'GUEST' ? '용병 · ' : ''}${p.shirtNumber === null ? '등번호 없음' : `#${p.shirtNumber}`} ${p.name}` : '선수 정보 없음'
export function matchHistoryChanges(before: MatchRecord | null, after: MatchRecord | null): HistoryChange[] {
  const changes: HistoryChange[] = []
  function add(label: string, oldValue: unknown, newValue: unknown, identityChanged = false) {
    const oldText = oldValue === null || oldValue === undefined || oldValue === '' ? '—' : String(oldValue)
    const newText = newValue === null || newValue === undefined || newValue === '' ? '—' : String(newValue)
    if (oldText !== newText || identityChanged) changes.push({ label, before: oldText, after: newText })
  }
  const kind = (m: MatchRecord | null) => m ? m.kind === 'INTERNAL' ? '자체전' : '외부 경기' : null
  add('경기 유형', kind(before), kind(after)); add('경기 날짜', before?.playedOn, after?.playedOn)
  add('경기 형식', before ? matchFormatLabel(before.matchFormat) : null, after ? matchFormatLabel(after.matchFormat) : null)
  if ((before?.tournamentId ?? null) !== (after?.tournamentId ?? null)) {
    const tournamentName = (match: MatchRecord | null) => match?.tournamentId == null ? null : match.tournamentName || '이름 미확인 대회'
    const oldName = tournamentName(before), newName = tournamentName(after)
    add(oldName === newName ? '대회 연결 · 다른 대회로 변경' : '대회 연결', oldName, newName, true)
  }
  add('대회 단계', before?.tournamentStage ? tournamentStageLabels[before.tournamentStage] : null, after?.tournamentStage ? tournamentStageLabels[after.tournamentStage] : null)
  add('포메이션 · A팀', before ? formationLabel(before.formationA) : null, after ? formationLabel(after.formationA) : null)
  if (before?.kind === 'INTERNAL' || after?.kind === 'INTERNAL') add('포메이션 · B팀', before ? formationLabel(before.formationB) : null, after ? formationLabel(after.formationB) : null)
  add('시작 시간', before?.kickoff?.slice(0, 5), after?.kickoff?.slice(0, 5))
  add('장소', before?.venue, after?.venue); add('상대팀', before?.opponent, after?.opponent)
  const score = (m: MatchRecord | null) => m?.scoreFor === null || !m ? null : `${m.kind === 'INTERNAL' ? 'A팀 : B팀' : '우리 팀 : 상대 팀'} · ${m.scoreFor} : ${m.scoreAgainst}`
  add('스코어', score(before), score(after)); add('코멘트', before?.notes, after?.notes)
  add('작성 상태', before ? recordingStageLabel(before.recordingStage) : null, after ? recordingStageLabel(after.recordingStage) : null)
  const oldPlayers = new Map((before?.participants ?? []).map(p => [p.playerId, p]))
  const newPlayers = new Map((after?.participants ?? []).map(p => [p.playerId, p]))
  const status = (p?: Participant) => p ? `${votes[p.vote]} · 실제 ${attendance[p.attendance]}` : null
  for (const id of new Set([...oldPlayers.keys(), ...newPlayers.keys()])) {
    add(`투표·출석 · ${playerName(newPlayers.get(id) ?? oldPlayers.get(id))}`, status(oldPlayers.get(id)), status(newPlayers.get(id)))
    const plannedTeam = (p?: Participant) => p ? p.plannedTeam ? `${p.plannedTeam}팀` : '미배정' : null
    if ((before?.kind === 'INTERNAL' || after?.kind === 'INTERNAL') && (oldPlayers.get(id)?.plannedTeam != null || newPlayers.get(id)?.plannedTeam != null))
      add(`사전 팀 배정 · ${playerName(newPlayers.get(id) ?? oldPlayers.get(id))}`, plannedTeam(oldPlayers.get(id)), plannedTeam(newPlayers.get(id)))
  }
  function lineup(m: MatchRecord | null, planned: boolean) {
    const people = new Map((m?.participants ?? []).map(p => [p.playerId, p]))
    const entries = planned ? (m?.plannedLineup ?? []).map(a => ({ ...a, goals: 0, assists: 0, freeKickGoals: 0, penaltyGoals: 0 }))
      : (m?.quarters ?? []).flatMap(q => q.lineup.map(a => ({ ...a, quarterNumber: q.number })))
    return new Map(entries.map(a => {
      const key = `${quarterLabel(a.quarterNumber, m?.matchFormat)} ${a.team}팀 ${slotNames[a.slot]} ${a.entryOrder === 1 ? '교체' : '선발'}`
      return [key, { identity: `${a.playerId}:${planned ? '' : `${a.goals}:${a.assists}:${a.freeKickGoals ?? 0}:${a.penaltyGoals ?? 0}`}`, value: `${playerName(people.get(a.playerId))}${planned ? '' : ` · ${a.goals}골 ${a.assists}도움 (${goalBreakdownText(a)})`}` }]
    }))
  }
  for (const planned of [true, false]) {
    const oldLineup = lineup(before, planned), newLineup = lineup(after, planned)
    for (const key of new Set([...oldLineup.keys(), ...newLineup.keys()])) {
      const oldValue = oldLineup.get(key), newValue = newLineup.get(key)
      if (oldValue?.identity !== newValue?.identity) add(`${planned ? '계획' : '실제 출전'} · ${key}`, oldValue?.value, newValue?.value)
    }
  }
  function goals(match: MatchRecord | null, number: number) {
    const events = match?.quarters.find(q => q.number === number)?.goalEvents
    if (events == null) return '골·도움 합계만 기록'
    return events.length ? events.map((e, i) => `${i + 1}. ${e.team}팀 ${playerName(match?.participants.find(p => p.playerId === e.scorerId))} 골 ← ${e.assistId == null ? '도움 없음 / 미확인' : playerName(match?.participants.find(p => p.playerId === e.assistId)) + ' 도움'} (${goalTypeLabels[e.type]})`).join('\n') : '골별 기록 · 0골'
  }
  for (const number of new Set([...(before?.quarters ?? []), ...(after?.quarters ?? [])].map(q => q.number)))
    add(`${quarterLabel(number, after?.matchFormat ?? before?.matchFormat)} · 득점·도움 연결`, goals(before, number), goals(after, number))
  return changes
}
