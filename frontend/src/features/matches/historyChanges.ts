import type { MatchRecord, Participant, Slot } from './api'

export interface HistoryChange { label: string; before: string; after: string }
const votes: Record<string, string> = { ATTENDING: '참석 예정', ABSENT: '불참 예정', UNDECIDED: '미정', UNANSWERED: '미투표' }
const attendance: Record<string, string> = { PRESENT: '참석', LATE: '지각', ABSENT: '불참', UNCONFIRMED: '미확인' }
const slotNames: Record<Slot, string> = { GK: 'GK', LB: 'LB', LCB: 'CB 좌', RCB: 'CB 우', RB: 'RB', CDM: 'CDM', LCM: 'CM 좌', RCM: 'CM 우', LW: 'LW', ST: 'ST', RW: 'RW' }
const playerName = (p?: Participant) => p ? `${p.playerType === 'GUEST' ? '용병 · ' : ''}${p.shirtNumber === null ? '등번호 없음' : `#${p.shirtNumber}`} ${p.name}` : '선수 정보 없음'
export function matchHistoryChanges(before: MatchRecord | null, after: MatchRecord | null): HistoryChange[] {
  const changes: HistoryChange[] = []
  function add(label: string, oldValue: unknown, newValue: unknown) {
    const oldText = oldValue === null || oldValue === undefined || oldValue === '' ? '—' : String(oldValue)
    const newText = newValue === null || newValue === undefined || newValue === '' ? '—' : String(newValue)
    if (oldText !== newText) changes.push({ label, before: oldText, after: newText })
  }
  const kind = (m: MatchRecord | null) => m ? m.kind === 'INTERNAL' ? '자체전' : '외부 경기' : null
  add('경기 유형', kind(before), kind(after)); add('경기 날짜', before?.playedOn, after?.playedOn)
  add('시작 시간', before?.kickoff?.slice(0, 5), after?.kickoff?.slice(0, 5))
  add('장소', before?.venue, after?.venue); add('상대팀', before?.opponent, after?.opponent)
  const score = (m: MatchRecord | null) => m?.scoreFor === null || !m ? null : `${m.kind === 'INTERNAL' ? 'A팀 : B팀' : '우리 팀 : 상대 팀'} · ${m.scoreFor} : ${m.scoreAgainst}`
  add('스코어', score(before), score(after)); add('코멘트', before?.notes, after?.notes)
  const oldPlayers = new Map((before?.participants ?? []).map(p => [p.playerId, p]))
  const newPlayers = new Map((after?.participants ?? []).map(p => [p.playerId, p]))
  const status = (p?: Participant) => p ? `${votes[p.vote]} · 실제 ${attendance[p.attendance]}` : null
  for (const id of new Set([...oldPlayers.keys(), ...newPlayers.keys()])) {
    add(`투표·출석 · ${playerName(newPlayers.get(id) ?? oldPlayers.get(id))}`, status(oldPlayers.get(id)), status(newPlayers.get(id)))
  }
  function lineup(m: MatchRecord | null, planned: boolean) {
    const people = new Map((m?.participants ?? []).map(p => [p.playerId, p]))
    const entries = planned ? (m?.plannedLineup ?? []).map(a => ({ ...a, goals: 0, assists: 0 }))
      : (m?.quarters ?? []).flatMap(q => q.lineup.map(a => ({ ...a, quarterNumber: q.number })))
    return new Map(entries.map(a => {
      const key = `${a.quarterNumber}쿼터 ${a.team}팀 ${slotNames[a.slot]} ${a.entryOrder === 1 ? '교체' : '선발'}`
      return [key, { identity: `${a.playerId}:${planned ? '' : `${a.goals}:${a.assists}`}`, value: `${playerName(people.get(a.playerId))}${planned ? '' : ` · ${a.goals}골 ${a.assists}도움`}` }]
    }))
  }
  for (const planned of [true, false]) {
    const oldLineup = lineup(before, planned), newLineup = lineup(after, planned)
    for (const key of new Set([...oldLineup.keys(), ...newLineup.keys()])) {
      const oldValue = oldLineup.get(key), newValue = newLineup.get(key)
      if (oldValue?.identity !== newValue?.identity) add(`${planned ? '계획' : '실제 출전'} · ${key}`, oldValue?.value, newValue?.value)
    }
  }
  return changes
}
