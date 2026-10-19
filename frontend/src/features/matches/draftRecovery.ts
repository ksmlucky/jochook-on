import type { MatchDraft, MatchRecord, MatchTeam } from './api'
import { formationOptions, slots } from './formations.ts'
import { tournamentStageLabels } from './tournamentFields.ts'
import { matchFormats, quarterNumbers } from './matchFormat.ts'
import type { MatchFormat } from './matchFormat'

export type DraftOwner = { username: string; teamId: number }
export type PendingMatchSave = { key: string; draft: MatchDraft; record: MatchRecord | null; destination: string }
export type RecoverySnapshot = {
  schema: 1; owner: DraftOwner; savedAt: number; record: MatchRecord | null; draft: MatchDraft
  kickoffHour: string; kickoffMinute: string; step: number; quarter: number; team: MatchTeam
  pending: PendingMatchSave | null
}
const prefix = 'jochook-on:match-draft:v1:'
export const RECOVERY_TTL_MS = 24 * 60 * 60 * 1000
const maxBytes = 1_000_000
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

function tabStorage(): Store | undefined {
  try { return typeof window === 'undefined' ? undefined : window.sessionStorage } catch { return undefined }
}
function key(owner: DraftOwner) { return `${prefix}${encodeURIComponent(owner.username)}:${owner.teamId}` }
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function integer(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max }
function text(value: unknown, max: number): value is string { return typeof value === 'string' && value.length <= max }
function oneOf(value: unknown, options: readonly string[]) { return typeof value === 'string' && options.includes(value) }
function validOwner(owner: unknown): owner is DraftOwner { return object(owner) && text(owner.username, 100) && owner.username.length > 0 && integer(owner.teamId, 1) }
function sameOwner(a: DraftOwner, b: DraftOwner) { return a.username === b.username && a.teamId === b.teamId }
function validRecord(value: unknown): value is MatchRecord | null {
  return value === null || (object(value) && integer(value.id, 1) && integer(value.version, 0) && validDraft(value))
}
function validDraft(value: unknown): value is MatchDraft {
  if (!object(value) || !oneOf(value.kind, ['EXTERNAL', 'INTERNAL']) || !text(value.playedOn, 10)
    || !(value.matchFormat == null || oneOf(value.matchFormat, matchFormats))
    || (value.kind === 'INTERNAL' && value.matchFormat === 'TWO_HALVES_30')
    || !text(value.venue, 100) || !text(value.opponent, 100) || !text(value.notes, 3000)
    // Preserve legacy times while the editor asks the user to correct them to 30-minute intervals.
    || !(value.kickoff === null || typeof value.kickoff === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value.kickoff))
    || ![value.scoreFor, value.scoreAgainst].every(score => score === null || integer(score, 0, 99))
    || ![value.formationA, value.formationB].every(formation => formation == null || oneOf(formation, formationOptions))
    || !(value.recordingStage == null || oneOf(value.recordingStage, ['ATTENDANCE', 'PLAN', 'ACTUAL', 'RESULT', 'COMPLETED']))
    || !(value.tournamentId == null || integer(value.tournamentId, 1))
    || !(value.tournamentName == null || text(value.tournamentName, 120))
    || !(value.tournamentStage == null || oneOf(value.tournamentStage, Object.keys(tournamentStageLabels)))
    || !(value.tournamentSelectionSpecified === undefined || typeof value.tournamentSelectionSpecified === 'boolean')) return false
  if (!Array.isArray(value.participants) || value.participants.length > 200 || !value.participants.every(p => object(p)
    && integer(p.playerId, 1) && text(p.name, 100) && (p.shirtNumber === null || integer(p.shirtNumber, 1, 99))
    && (p.birthYear === null || integer(p.birthYear, 1000, 9999)) && oneOf(p.playerType, ['MEMBER', 'GUEST'])
    && oneOf(p.vote, ['ATTENDING', 'ABSENT', 'UNDECIDED', 'UNANSWERED'])
    && oneOf(p.attendance, ['PRESENT', 'LATE', 'ABSENT', 'UNCONFIRMED'])
    && (p.plannedTeam == null || oneOf(p.plannedTeam, ['A', 'B'])))) return false
  if (new Set(value.participants.map(p => p.playerId)).size !== value.participants.length) return false
  const validEntry = (a: unknown) => object(a) && oneOf(a.team, ['A', 'B']) && oneOf(a.slot, slots)
    && integer(a.playerId, 1) && integer(a.entryOrder, 0, 1)
  const periodCount = quarterNumbers(value.matchFormat as MatchFormat | null | undefined).length
  if (!Array.isArray(value.quarters) || value.quarters.length !== periodCount || !value.quarters.every(q => object(q)
    && (q.goalsAgainst == null || integer(q.goalsAgainst, 0, 99))
    && (q.goalsAgainstSpecified == null || typeof q.goalsAgainstSpecified === 'boolean')
    && integer(q.number, 1, periodCount) && Array.isArray(q.lineup) && q.lineup.length <= 44
    && (q.goalEvents == null || Array.isArray(q.goalEvents) && q.goalEvents.length <= 1000 && q.goalEvents.every(e => object(e)
      && integer(e.scorerId, 1) && (e.assistId === null || integer(e.assistId, 1)) && oneOf(e.team, ['A', 'B']) && oneOf(e.type, ['NORMAL', 'FREE_KICK', 'PENALTY'])))
    && q.lineup.every(a => validEntry(a) && object(a) && integer(a.goals, 0, 99) && integer(a.assists, 0, 99)
      && [a.freeKickGoals, a.penaltyGoals].every(n => n == null || integer(n, 0, 99))))) return false
  if (new Set(value.quarters.map(q => q.number)).size !== periodCount) return false
  return Array.isArray(value.plannedLineup) && value.plannedLineup.length <= periodCount * 44
    && value.plannedLineup.every(a => validEntry(a) && object(a) && integer(a.quarterNumber, 1, periodCount))
}
function validSnapshot(value: unknown, owner: DraftOwner, now: number): value is RecoverySnapshot {
  if (!object(value) || value.schema !== 1 || !validOwner(value.owner) || !sameOwner(value.owner, owner)
    || !integer(value.savedAt, 1) || now - value.savedAt >= RECOVERY_TTL_MS || value.savedAt > now + 60_000
    || !validRecord(value.record) || !validDraft(value.draft)
    || !oneOf(value.team, ['A', 'B']) || !integer(value.step, 0, 3) || !integer(value.quarter, 1, 4)
    || !(value.kickoffHour === '' || typeof value.kickoffHour === 'string' && /^(?:[01]\d|2[0-3])$/.test(value.kickoffHour))
    || !oneOf(value.kickoffMinute, ['', '00', '30'])) return false
  if (value.pending === null) return true
  const p = value.pending
  return object(p) && typeof p.key === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(p.key)
    && validDraft(p.draft) && validRecord(p.record) && oneOf(p.destination, ['save', 'complete', 'plan', 'lineup', 'totals', 'actual-from-plan', 'quarter-1', 'quarter-2', 'quarter-3', 'quarter-4'])
    && (p.record?.id ?? null) === (value.record?.id ?? null) && (p.record?.version ?? null) === (value.record?.version ?? null)
}

function cleanDraft(draft: MatchDraft): MatchDraft {
  return { kind: draft.kind, playedOn: draft.playedOn, kickoff: draft.kickoff, venue: draft.venue,
    ...(draft.matchFormat === undefined ? {} : { matchFormat: draft.matchFormat }),
    opponent: draft.opponent, notes: draft.notes, scoreFor: draft.scoreFor, scoreAgainst: draft.scoreAgainst,
    ...(draft.recordingStage === undefined ? {} : { recordingStage: draft.recordingStage }),
    ...(draft.formationA === undefined ? {} : { formationA: draft.formationA }),
    ...(draft.formationB === undefined ? {} : { formationB: draft.formationB }),
    ...(draft.tournamentId === undefined ? {} : { tournamentId: draft.tournamentId }),
    ...(draft.tournamentName === undefined ? {} : { tournamentName: draft.tournamentName }),
    ...(draft.tournamentStage === undefined ? {} : { tournamentStage: draft.tournamentStage }),
    ...(draft.tournamentSelectionSpecified === undefined ? {} : { tournamentSelectionSpecified: draft.tournamentSelectionSpecified }),
    participants: draft.participants.map(p => ({ playerId: p.playerId, name: p.name, shirtNumber: p.shirtNumber,
      birthYear: p.birthYear, playerType: p.playerType, vote: p.vote, attendance: p.attendance,
      ...(p.plannedTeam === undefined ? {} : { plannedTeam: p.plannedTeam }) })),
    quarters: draft.quarters.map(q => ({ number: q.number,
      ...(q.goalsAgainst === undefined ? {} : { goalsAgainst: q.goalsAgainst }),
      ...(q.goalsAgainstSpecified === undefined ? {} : { goalsAgainstSpecified: q.goalsAgainstSpecified }),
      ...(q.goalEvents === undefined ? {} : { goalEvents: q.goalEvents?.map(e => ({ scorerId: e.scorerId, assistId: e.assistId, type: e.type, team: e.team })) ?? null }),
      lineup: q.lineup.map(a => ({ team: a.team, slot: a.slot,
      playerId: a.playerId, entryOrder: a.entryOrder, goals: a.goals, assists: a.assists,
      ...(a.freeKickGoals === undefined ? {} : { freeKickGoals: a.freeKickGoals }),
      ...(a.penaltyGoals === undefined ? {} : { penaltyGoals: a.penaltyGoals }),
    })) })),
    plannedLineup: draft.plannedLineup.map(a => ({ team: a.team, slot: a.slot, quarterNumber: a.quarterNumber,
      entryOrder: a.entryOrder, playerId: a.playerId })),
  }
}
function cleanRecord(record: MatchRecord | null): MatchRecord | null { return record && { ...cleanDraft(record), id: record.id, version: record.version } }
function cleanSnapshot(value: RecoverySnapshot): RecoverySnapshot {
  return { schema: 1, owner: { username: value.owner.username, teamId: value.owner.teamId }, savedAt: value.savedAt,
    record: cleanRecord(value.record), draft: cleanDraft(value.draft), kickoffHour: value.kickoffHour,
    kickoffMinute: value.kickoffMinute, step: value.step, quarter: value.quarter, team: value.team,
    pending: value.pending && { key: value.pending.key, draft: cleanDraft(value.pending.draft),
      record: cleanRecord(value.pending.record), destination: value.pending.destination },
  }
}

/** A tab-scoped recovery copy, not an authenticated source of truth or a server save. */
export function loadMatchRecovery(owner: DraftOwner, storage = tabStorage(), now = Date.now()): RecoverySnapshot | null {
  if (!validOwner(owner) || !storage) return null
  try {
    const raw = storage.getItem(key(owner))
    if (!raw) return null
    const value: unknown = raw.length <= maxBytes ? JSON.parse(raw) : null
    if (validSnapshot(value, owner, now)) return cleanSnapshot(value)
  } catch { /* Corrupt or unavailable tab storage must never break the editor. */ }
  try { storage.removeItem(key(owner)) } catch { /* Storage may be blocked. */ }
  return null
}
export function saveMatchRecovery(snapshot: RecoverySnapshot, storage = tabStorage(), now = Date.now()): boolean {
  if (!storage || !validOwner(snapshot.owner)) return false
  const value = { ...snapshot, savedAt: now }
  if (!validSnapshot(value, snapshot.owner, now)) return false
  try {
    const raw = JSON.stringify(cleanSnapshot(value))
    if (raw.length > maxBytes) return false
    storage.setItem(key(snapshot.owner), raw)
    return true
  } catch { return false }
}
export function clearMatchRecovery(owner: DraftOwner, storage = tabStorage()): void {
  if (!validOwner(owner) || !storage) return
  try { storage.removeItem(key(owner)) } catch { /* Cleanup is best effort when storage is unavailable. */ }
}
/** Explicit logout clears this account's copies in this tab; expiry does not call this. */
export function clearAccountRecoveries(username: string, storage = tabStorage()): void {
  if (!storage || !username) return
  const accountPrefix = `${prefix}${encodeURIComponent(username)}:`
  try {
    for (let i = storage.length - 1; i >= 0; i--) {
      const storedKey = storage.key(i)
      if (storedKey?.startsWith(accountPrefix)) storage.removeItem(storedKey)
    }
  } catch { /* No credential or team code is ever stored here. */ }
}
