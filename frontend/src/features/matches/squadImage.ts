import type { MatchTeam, Participant, PlannedEntry } from './api'
import { formationFor, formationLabel, pitchRowsFor, slotGroup, slotLabels } from './formations.ts'
import type { Formation, Slot } from './formations'
import { quarterLabel, quarterNumbers } from './matchFormat.ts'
import type { MatchFormat } from './matchFormat'

export interface SquadImageInput {
  teamName: string; playedOn: string; kickoff: string | null; opponent: string
  internal: boolean; unsaved: boolean; matchFormat?: MatchFormat | null
  formationA?: Formation | null; formationB?: Formation | null
  quarter: number; team: MatchTeam; entries: PlannedEntry[]; participants: Participant[]
}
export const squadImageSize = { width: 1080, height: 1480 }
export function canShareSquadFile(file: File, device: Pick<Navigator, 'share' | 'canShare'>): boolean {
  try { return typeof device.share === 'function' && typeof device.canShare === 'function' && device.canShare({ files: [file] }) }
  catch { return false }
}
const escape = (text: string) => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!))
const palette = { GK: ['#fff4cf', '#956400'], DF: ['#eaf1ff', '#3566a6'], MF: ['#e8f5eb', '#27734a'], FW: ['#fff0f1', '#b63d51'], UN: ['#eff2ef', '#526f60'] } as const
const text = (x: number, y: number, value: string, size: number, color = '#243c34', weight = 500, maxWidth?: number) =>
  `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="${color}" font-weight="${weight}"${maxWidth && [...value].length * size * 0.8 > maxWidth ? ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"` : ''}>${escape(value)}</text>`

/** Fixed export coordinates preserve the staggered 3-5-2 board, independent of screen width. */
export function squadImagePositions(formation: Formation): { slot: Slot; x: number; y: number }[] {
  const rows = pitchRowsFor(formation)
  return rows.flatMap((row, index) => row.map((slot, column) => {
    const x = row.length === 1 ? 540 : 150 + column * 780 / (row.length - 1)
    let y = 350 + index * 840 / (rows.length - 1)
    if (formation === 'F352') {
      if (slot === 'CAM') y = 510
      if (slot === 'LWB' || slot === 'RWB') y = 680
      if (slot === 'LCM' || slot === 'RCM') y = 840
      if (slot === 'LCB' || slot === 'CCB' || slot === 'RCB') y = 1010
      if (slot === 'GK') y = 1190
    }
    // Paired central players stay central rather than on the touchlines.
    return { slot, x: row.length === 2 ? 365 + column * 350 : x, y }
  }))
}

export function buildSquadImage(input: SquadImageInput): { svg: string; filename: string; label: string } {
  if (!quarterNumbers(input.matchFormat).includes(input.quarter)) throw new Error('현재 경기 형식에 맞는 쿼터를 선택해 주세요.')
  const team = input.internal ? input.team : 'A'
  const formation = formationFor(input, team)
  const period = quarterLabel(input.quarter, input.matchFormat)
  const label = `${period}${input.internal ? ` · ${team}팀` : ''} · ${formationLabel(formation)}`
  const selected = input.entries.filter(e => e.quarterNumber === input.quarter && e.team === team)
  const players = new Map(input.participants.map(p => [p.playerId, p]))
  const playerName = (entry?: PlannedEntry) => entry ? players.get(entry.playerId)?.name ?? '선수 미확인' : '미배치'
  const shirt = (entry?: PlannedEntry) => {
    const p = entry && players.get(entry.playerId)
    return p ? `${p.playerType === 'GUEST' ? '용병 · ' : ''}${p.shirtNumber == null ? '번호 없음' : `#${p.shirtNumber}`}` : '—'
  }
  const cards = squadImagePositions(formation).map(({ slot, x, y }) => {
    const starter = selected.find(e => e.slot === slot && e.entryOrder === 0)
    const sub = selected.find(e => e.slot === slot && e.entryOrder === 1)
    const [fill, accent] = palette[slotGroup(slot)]
    return `<g><rect x="${x - 101}" y="${y - 67}" width="202" height="${sub ? 148 : 110}" rx="18" fill="white" stroke="${accent}" stroke-width="2"/>
      <rect x="${x - 100}" y="${y - 66}" width="200" height="36" rx="16" fill="${fill}"/>
      ${text(x, y - 41, slotLabels[slot], 22, accent, 700)}
      ${text(x, y - 6, shirt(starter), 20, '#62786d', 500, 180)}
      ${text(x, y + 28, playerName(starter), 30, starter ? '#243c34' : '#83958c', 700, 180)}
      ${sub ? `<path d="M ${x - 88} ${y + 43}h176" stroke="#dbe5dc"/>${text(x, y + 69, `↳ ${shirt(sub)} ${playerName(sub)}`, 21, accent, 600, 180)}` : ''}</g>`
  }).join('')
  const heading = input.internal ? `${input.teamName} · 자체전` : input.teamName
  const description = input.internal ? 'A팀 vs B팀' : `vs ${input.opponent || '상대 팀 미입력'}`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1480" viewBox="0 0 1080 1480" role="img" aria-label="${escape(label)}">
    <rect width="1080" height="1480" fill="#f7f8f4"/><g font-family="Arial, Malgun Gothic, Apple SD Gothic Neo, sans-serif">
    ${text(540, 50, '조축ON  /  MATCH SQUAD', 24, '#2d6a53', 700)}
    ${text(540, 103, heading, 42, '#243c34', 700, 960)}${text(540, 144, description, 27, '#62786d', 500, 960)}
    ${text(540, 184, `${input.playedOn || '날짜 미입력'}${input.kickoff ? ` · ${input.kickoff.slice(0, 5)}` : ''}  |  ${label}`, 26, '#243c34', 600, 980)}
    <rect x="26" y="216" width="1028" height="1100" rx="26" fill="#e7f0e0"/>
    ${[0, 2, 4, 6].map(i => `<rect x="28" y="${236 + i * 132}" width="1024" height="132" fill="#edf4e7"/>`).join('')}
    <g fill="none" stroke="#9fba9e" stroke-width="3"><rect x="46" y="236" width="988" height="1060"/><path d="M46 766h988"/><circle cx="540" cy="766" r="160"/><path d="M290 236v130h500V236 M410 236v48h260v-48 M290 1296v-130h500v130 M410 1296v-48h260v48"/></g>
    ${text(540, 268, '공격 방향 ↑', 20, '#658265')}${cards}
    ${text(540, 1360, `선발 ${selected.filter(e => e.entryOrder === 0).length}/11 · 교체 ${selected.filter(e => e.entryOrder === 1).length}명  |  ↳ 교체 선수`, 25, '#526f60', 500)}
    ${text(540, 1405, input.unsaved ? '저장 전 · 현재 입력한 스쿼드' : '저장된 스쿼드', 25, input.unsaved ? '#9a631b' : '#526f60', 700)}
    ${text(540, 1445, '우리의 축구가 모이는 곳 · 조축ON', 21, '#7b8b81')}</g></svg>`
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.playedOn) ? input.playedOn : 'undated'
  return { svg, filename: `jochook-on-${date}-${input.quarter}Q${input.internal ? `-${team}` : ''}.png`, label }
}

export async function squadImagePng(svg: string, size = squadImageSize): Promise<Blob> {
  if (!Number.isInteger(size.width) || !Number.isInteger(size.height) || size.width < 1 || size.height < 1 || size.width * size.height > 5_000_000) throw new Error('이미지 크기를 확인해 주세요.')
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('이미지를 만들지 못했어요. 다시 시도해 주세요.')); image.src = url })
    const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('이 브라우저에서 이미지를 만들 수 없어요.')
    context.drawImage(image, 0, 0)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('이미지를 만들지 못했어요. 다시 시도해 주세요.')), 'image/png'))
  } finally { URL.revokeObjectURL(url) }
}
