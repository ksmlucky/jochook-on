import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useEditGuard } from '../../app/LeaveGuard'
import { AccessRequestError } from '../auth/api'
import { findRecoveryAccounts, issueResetLink, resetLinkUrl, resetRequestMessage } from '../auth/passwordReset'
import type { IssuedResetLink, RecoveryAccount } from '../auth/passwordReset'
import { ConfirmAction, koreanTime, useRetryLimit } from './AccessUi'
import '../auth/password-reset.css'

export function AccountRecoveryManager({ onSessionExpired }: { onSessionExpired: () => void }) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [accounts, setAccounts] = useState<RecoveryAccount[] | null>(null)
  const [selected, setSelected] = useState<RecoveryAccount | null>(null)
  const [verified, setVerified] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [issued, setIssued] = useState<IssuedResetLink | null>(null)
  const [copied, setCopied] = useState('')
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const mounted = useRef(true)
  const searchRequest = useRef<AbortController | null>(null)
  const linkRef = useRef<HTMLInputElement>(null)
  const retry = useRetryLimit()
  useEditGuard(false, busy)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; searchRequest.current?.abort() } }, [])
  function sessionFailure(cause: unknown) {
    if (cause instanceof AccessRequestError && [401, 403].includes(cause.status)) onSessionExpired()
  }
  async function search(event: FormEvent) {
    event.preventDefault()
    if (lock.current || searching || retry.seconds > 0) return
    const controller = new AbortController(); searchRequest.current?.abort(); searchRequest.current = controller
    setSearching(true); setError(''); setAccounts(null); setSelected(null); setVerified(false); setIssued(null); setCopied('')
    try { const result = await findRecoveryAccounts(query.trim(), controller.signal); if (!controller.signal.aborted) setAccounts(result) }
    catch (cause) {
      if (controller.signal.aborted) return
      retry.inspect(cause); sessionFailure(cause); setError('운영진 계정을 찾지 못했어요. 접속 상태를 확인하고 다시 시도해 주세요.')
    } finally { if (!controller.signal.aborted) setSearching(false) }
  }
  async function issue() {
    if (lock.current || !selected || !verified || retry.seconds > 0) return
    lock.current = true; setBusy(true); setError(''); setIssued(null); setCopied('')
    try {
      const result = await issueResetLink(selected.id)
      if (mounted.current) { setIssued(result); setVerified(false); setSelected(null) }
    } catch (cause) {
      if (!mounted.current) return
      retry.inspect(cause); sessionFailure(cause); setError(resetRequestMessage(cause, 'issue'))
    } finally { lock.current = false; if (mounted.current) { setBusy(false); setConfirming(false) } }
  }
  const link = issued ? resetLinkUrl(window.location.origin, window.location.pathname, issued.token) : ''
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setCopied('복구 링크를 복사했어요. 본인 확인한 대상자에게만 전달해 주세요.') }
    catch { setCopied('자동 복사를 사용할 수 없어요. 선택된 링크를 직접 복사해 주세요.'); linkRef.current?.focus(); linkRef.current?.select() }
  }
  return <section className="account-recovery-manager" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>운영진 계정 복구</h2>
    <p>본인 확인을 마친 감독·코치에게 30분 동안 한 번 사용할 수 있는 복구 링크를 발급해요. 서비스 관리자 계정은 대상에서 제외해요.</p>
    <form className="account-recovery-search" onSubmit={event => void search(event)}>
      <label htmlFor={`${id}-query`}>운영진 아이디 검색<input id={`${id}-query`} value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" disabled={busy || searching} /></label>
      <button type="submit" className="secondary-button" disabled={busy || searching || retry.seconds > 0}>{searching ? '찾는 중…' : '계정 찾기'}</button>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {retry.seconds > 0 && <p role="status">{retry.seconds}초 뒤 다시 시도할 수 있어요.</p>}
    {accounts && !issued && <><p className="password-reset-help">최대 20개 계정을 보여줘요. 찾는 계정이 없으면 아이디를 더 자세히 입력해 주세요.</p>
      {accounts.length ? <ul className="account-recovery-list">{accounts.map(account => <li key={account.id}><button type="button" aria-pressed={selected?.id === account.id} disabled={busy} onClick={() => { setSelected(account); setVerified(false); setError('') }}>
        <strong>{account.username}</strong><span>{account.teams.map(team => `${team.teamName} · ${team.role === 'DIRECTOR' ? '감독' : '코치'}`).join(' / ')}</span>
      </button></li>)}</ul> : <p>발급 가능한 운영진 계정이 없어요.</p>}</>}
    {selected && !issued && <div className="account-recovery-verification">
      <strong>발급 대상 · {selected.username}</strong>
      <label><input type="checkbox" checked={verified} disabled={busy} onChange={event => setVerified(event.target.checked)} />기존 연락처 등으로 대상자 본인임을 확인했습니다.</label>
      <p className="password-reset-help">새 링크를 발급하면 이 계정의 이전 복구 링크는 사용할 수 없어요.</p>
      <button type="button" className="primary-button" disabled={!verified || busy || retry.seconds > 0} onClick={() => setConfirming(true)}>복구 링크 발급</button>
    </div>}
    {confirming && selected && <ConfirmAction title="복구 링크를 발급할까요?" description={`${selected.username} 계정의 본인 확인을 완료했어요. 이전 링크는 폐기되고 30분 동안 한 번 사용할 수 있는 새 링크가 발급돼요.`} confirmLabel={busy ? '발급 중…' : '확인 후 발급'} onConfirm={() => void issue()} onCancel={() => { if (!lock.current) setConfirming(false) }} />}
    {issued && <div className="account-recovery-issued" role="region" aria-label="발급한 복구 링크">
      <h3>{issued.username} · 복구 링크</h3><p>만료 · {koreanTime(issued.expiresAt)}</p><p>이 화면에서만 확인할 수 있어요. 닫기 전에 복사해 본인 확인한 대상자에게만 전달해 주세요.</p>
      <label htmlFor={`${id}-link`}>일회용 복구 링크</label><input ref={linkRef} id={`${id}-link`} readOnly value={link} autoComplete="off" spellCheck={false} onFocus={event => event.target.select()} />
      {copied && <p role="status">{copied}</p>}
      <div className="password-reset-actions"><button type="button" className="secondary-button" onClick={() => void copyLink()}>복구 링크 복사</button><button type="button" className="primary-button" onClick={() => { setIssued(null); setCopied('') }}>확인했어요 · 닫기</button></div>
    </div>}
  </section>
}
