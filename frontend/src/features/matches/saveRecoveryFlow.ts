import type { MatchRecord } from './api'
import type { PendingMatchSave } from './draftRecovery'

export interface MatchSaveReceipt { matchId: number; version: number; exists: boolean }
export type SaveAttemptKind = 'initial-save' | 'recovery'
export function pendingSaveFailureDisposition(attempt: SaveAttemptKind, status?: number): 'editable' | 'blocked' | 'pending' {
  if (status === 404 || status === 409) return 'blocked'
  // A failed receipt/record read says nothing about whether the original mutation committed.
  // Only a definite rejection of the first mutation may release its key for editing.
  if (attempt === 'initial-save' && status !== undefined && status >= 400 && status < 500 && status !== 401 && status !== 403) return 'editable'
  return 'pending'
}
interface SaveTransport {
  receipt: (key: string) => Promise<MatchSaveReceipt | null>
  save: (pending: PendingMatchSave) => Promise<MatchRecord>
  match: (id: number) => Promise<MatchRecord>
}

export class SaveResultChangedError extends Error {
  constructor() { super('저장된 뒤 다른 변경 또는 삭제가 확인되었습니다. 초안은 보관했으며 덮어쓰지 않습니다. 최신 서버 기록을 확인해 주세요.') }
}

export async function resolvePendingSave(pending: PendingMatchSave, transport: SaveTransport): Promise<MatchRecord> {
  const receipt = await transport.receipt(pending.key)
  if (receipt && !receipt.exists) throw new SaveResultChangedError()
  let result: MatchSaveReceipt
  if (receipt) result = receipt
  else {
    const saved = await transport.save(pending)
    result = { matchId: saved.id, version: saved.version, exists: true }
  }
  const current = await transport.match(result.matchId)
  if (current.id !== result.matchId || current.version !== result.version) throw new SaveResultChangedError()
  return current
}
