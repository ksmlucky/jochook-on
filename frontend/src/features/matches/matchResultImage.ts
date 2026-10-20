import type { MatchRecord, MatchTeam } from './api'

interface PlayerTotal { playerId: number; goals: number; assists: number }
const ink = '#243c34', muted = '#526b5e', green = '#28624c'
const limit = 16
const escape = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!))
const clean = (value: string) => value.replace(/\s+/g, ' ').trim()
const shortened = (value: string, length: number) => [...value].length > length ? [...value].slice(0, length - 1).join('') + '…' : value
const lineText = (x: number, y: number, value: string, size: number, color = ink, weight = 500, anchor = 'start') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${color}" font-weight="${weight}">${escape(value)}</text>`
const count = (value: number) => Number.isFinite(value) && value > 0 ? value : 0

/** Uses persisted actual records only; planned lineups and participation votes are not scoring data. */
export function buildMatchResultImage({ record, teamName }: { record: MatchRecord; teamName: string }): { svg: string; filename: string; label: string; width: number; height: number } {
  const internal = record.kind === 'INTERNAL'
  const sides: MatchTeam[] = internal ? ['A', 'B'] : ['A']
  const totals: Record<MatchTeam, Map<number, PlayerTotal>> = { A: new Map(), B: new Map() }
  const add = (side: MatchTeam, playerId: number, goals: number, assists: number) => {
    const previous = totals[side].get(playerId) ?? { playerId, goals: 0, assists: 0 }
    totals[side].set(playerId, { playerId, goals: previous.goals + goals, assists: previous.assists + assists })
  }
  for (const quarter of record.quarters) {
    if (Array.isArray(quarter.goalEvents)) {
      for (const event of quarter.goalEvents) {
        add(event.team, event.scorerId, 1, 0)
        if (event.assistId != null) add(event.team, event.assistId, 0, 1)
      }
    } else {
      for (const appearance of quarter.lineup) add(appearance.team, appearance.playerId, count(appearance.goals), count(appearance.assists))
    }
  }
  const players = new Map(record.participants.map(player => [player.playerId, player]))
  const playerName = (id: number) => clean(players.get(id)?.name ?? '') || '선수 미확인'
  const metricRows = (side: MatchTeam, metric: 'goals' | 'assists') => [...totals[side].values()]
    .filter(row => row[metric] > 0)
    .sort((a, b) => b[metric] - a[metric] || playerName(a.playerId).localeCompare(playerName(b.playerId), 'ko') || a.playerId - b.playerId)
  const teamGoals = (side: MatchTeam) => [...totals[side].values()].reduce((sum, row) => sum + row.goals, 0)
  const warnings: string[] = []
  if (record.scoreFor != null && teamGoals('A') !== record.scoreFor) warnings.push(internal ? 'A팀 스코어와 선수 득점 합계가 달라요.' : '우리 팀 스코어와 선수 득점 합계가 달라요.')
  if (internal && record.scoreAgainst != null && teamGoals('B') !== record.scoreAgainst) warnings.push('B팀 스코어와 선수 득점 합계가 달라요.')
  if (!internal && record.scoreAgainst != null && record.quarters.length > 0 && record.quarters.every(quarter => quarter.goalsAgainst != null)
    && record.quarters.reduce((sum, quarter) => sum + (quarter.goalsAgainst ?? 0), 0) !== record.scoreAgainst) warnings.push('최종 실점과 구간별 실점 합계가 달라요.')
  const score = `${record.scoreFor ?? '—'} : ${record.scoreAgainst ?? '—'}`
  const category = record.tournamentId != null ? clean(record.tournamentName ?? '') || '대회' : internal ? '리그 · 자체전' : '리그'
  const heading = internal ? clean(teamName) || '우리 팀' : '경기 결과'
  const status = record.recordingStage === 'COMPLETED' ? '기록 완료' : record.recordingStage ? '작성 중 · 기록이 바뀔 수 있어요' : '기존 기록 · 상태 미지정'
  const leftName = internal ? 'A팀' : clean(teamName) || '우리 팀'
  const rightName = internal ? 'B팀' : clean(record.opponent) || '상대 팀 미입력'
  const label = `${record.playedOn || '날짜 미입력'} ${leftName} ${score} ${rightName} 경기 결과`
  const body: string[] = []
  let y = 590
  let truncatedNames = false
  const nameLines = (name: string, max: number): string[] => {
    const chars = [...name]
    if (chars.length > max * 2) truncatedNames = true
    return chars.length <= max ? [name] : [chars.slice(0, max).join(''), shortened(chars.slice(max).join(''), max)]
  }
  const teamLabel = (x: number, value: string) => nameLines(value, 10).map((line, index) => lineText(x, 345 + index * 35, line, 29, '#ffffff', 700, 'middle')).join('')
  const headerTeamLabels = teamLabel(235, leftName) + teamLabel(845, rightName)
  for (const side of sides) {
    const goals = metricRows(side, 'goals'), assists = metricRows(side, 'assists')
    const rows = Math.max(1, Math.min(limit, Math.max(goals.length, assists.length)))
    const overflow = goals.length > limit || assists.length > limit
    const sectionHeight = 102 + rows * 66 + (overflow ? 42 : 0)
    body.push(`<rect x="40" y="${y}" width="1000" height="${sectionHeight}" rx="24" fill="#ffffff" stroke="#dce5da"/>`)
    body.push(lineText(68, y + 36, internal ? `${side}팀 기록` : '우리 팀 선수 기록', 25, green, 700))
    body.push(lineText(68, y + 78, '득점', 22, muted, 700), lineText(572, y + 78, '도움', 22, muted, 700))
    for (const [metric, entries, x] of [['goals', goals, 68], ['assists', assists, 572]] as const) {
      if (!entries.length) body.push(lineText(x, y + 128, metric === 'goals' ? '득점 기록 없음' : '도움 기록 없음', 24, muted))
      entries.slice(0, limit).forEach((entry, index) => {
        const baseline = y + 116 + index * 66
        const player = players.get(entry.playerId)
        const shirt = player?.shirtNumber == null ? '' : `#${player.shirtNumber} `
        const displayed = `${shirt}${playerName(entry.playerId)}`
        const lines = nameLines(displayed, 12)
        body.push(`<g data-metric="${metric}" data-team="${side}">`)
        lines.forEach((line, lineIndex) => body.push(lineText(x, baseline + lineIndex * 27, line, 24, ink, 600)))
        body.push(lineText(x + 402, baseline + 8, `${entry[metric]}${metric === 'goals' ? '골' : '도움'}`, 26, green, 800, 'end'), '</g>')
      })
      if (entries.length > limit) body.push(lineText(x, y + sectionHeight - 20, `외 ${entries.length - limit}명 · 전체는 앱에서 확인`, 20, muted))
    }
    y += sectionHeight + 22
  }
  if (warnings.length) {
    const height = 38 + warnings.length * 29 + 32
    body.push(`<rect x="40" y="${y}" width="1000" height="${height}" rx="18" fill="#fff3df"/>`)
    warnings.forEach((warning, index) => body.push(lineText(64, y + 34 + index * 29, warning, 23, '#805614', 600)))
    body.push(lineText(64, y + height - 20, '최종 스코어를 그대로 표시했어요. 미입력·자책골 등을 확인해 주세요.', 21, '#805614'))
    y += height + 20
  }
  if (truncatedNames) { body.push(lineText(540, y + 22, '긴 이름은 …로 줄였어요. 전체 이름은 앱에서 확인해 주세요.', 21, muted, 500, 'middle')); y += 38 }
  body.push(lineText(540, y + 26, '저장된 경기 기록 기준 · 조축ON', 23, muted, 600, 'middle'))
  const height = y + 66
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}" viewBox="0 0 1080 ${height}" role="img" aria-label="${escape(label)}">
    <rect width="1080" height="${height}" fill="#f4f7ef"/><g font-family="Arial, Malgun Gothic, Apple SD Gothic Neo, sans-serif">
      <rect x="20" y="20" width="1040" height="540" rx="32" fill="${green}"/>
      ${lineText(62, 75, '조축ON  /  MATCH RESULT', 25, '#e5efcf', 700)}
      ${lineText(62, 128, shortened(heading, 26), 38, '#ffffff', 800)}
      ${lineText(62, 175, `${record.playedOn || '날짜 미입력'}${record.kickoff ? ` · ${record.kickoff.slice(0, 5)}` : ''}`, 27, '#ffffff', 600)}
      ${lineText(62, 215, shortened(category, 35), 26, '#e5efcf', 600)}
      ${headerTeamLabels}
      ${lineText(540, 353, score, 76, '#ffffff', 800, 'middle')}
      <path d="M62 420H1018" stroke="#ffffff" stroke-opacity=".22"/>
      ${lineText(540, 472, status, 27, '#ffffff', 700, 'middle')}
      ${lineText(540, 518, record.scoreFor == null || record.scoreAgainst == null ? '— 스코어 미입력' : internal ? '자체전 · A팀 : B팀' : '우리 팀 : 상대 팀', 22, '#e5efcf', 500, 'middle')}
      ${body.join('')}
    </g></svg>`
  const date = /^\d{4}-\d{2}-\d{2}$/.test(record.playedOn) ? record.playedOn : 'undated'
  return { svg, filename: `jochook-on-result-${date}.png`, label, width: 1080, height }
}
