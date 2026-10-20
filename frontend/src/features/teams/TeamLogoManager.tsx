import { useEffect, useRef, useState } from 'react'
import { SessionExpiredError } from '../auth/api'
import { ACCESS_CHANGED_EVENT, captureTeamScope } from '../auth/teamRequest'
import { getTeamLogo, TEAM_LOGO_CHANGED, updateTeamLogo, validateLogoFile } from './teamLogo'
import './team-logo.css'

export function TeamBadge({ teamId, teamName, className = '' }: { teamId?: number; teamName: string; className?: string }) {
  const [image, setImage] = useState<{ teamId: number; url: string } | null>(null)
  const [revision, setRevision] = useState(0)
  let accessSignal: AbortSignal | undefined
  try { accessSignal = captureTeamScope().controller.signal } catch { /* No active team means placeholder. */ }
  useEffect(() => {
    const changed = () => { setImage(null); setRevision(value => value + 1) }
    window.addEventListener(TEAM_LOGO_CHANGED, changed)
    window.addEventListener(ACCESS_CHANGED_EVENT, changed)
    return () => { window.removeEventListener(TEAM_LOGO_CHANGED, changed); window.removeEventListener(ACCESS_CHANGED_EVENT, changed) }
  }, [])
  useEffect(() => {
    let active = true
    let url: string | undefined
    const clear = () => { active = false; if (url) { URL.revokeObjectURL(url); url = undefined }; setImage(null) }
    accessSignal?.addEventListener('abort', clear, { once: true })
    setImage(null)
    if (teamId) void getTeamLogo(teamId).then(blob => {
      if (!active || !blob) return
      url = URL.createObjectURL(blob)
      setImage({ teamId, url })
    }).catch(() => { /* Team request dispatches expired-session handling; the badge keeps its fallback. */ })
    return () => { active = false; accessSignal?.removeEventListener('abort', clear); if (url) URL.revokeObjectURL(url) }
  }, [teamId, revision, accessSignal])
  return <span className={`team-badge ${className}`} aria-label={`${teamName} 로고`} role="img">
    {image && image.teamId === teamId ? <img src={image.url} alt="" /> : <span aria-hidden="true">{teamName.trim().slice(0, 1) || '팀'}</span>}
  </span>
}

export function TeamLogoManager({ teamId, teamName }: { teamId: number; teamName: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const generation = useRef(0)
  let accessSignal: AbortSignal | undefined
  try { accessSignal = captureTeamScope().controller.signal } catch { /* Session UI handles reauthentication. */ }
  useEffect(() => {
    const reset = () => {
      generation.current++
      setFile(null); setMessage(''); setError(''); setBusy(false)
      if (input.current) input.current.value = ''
    }
    reset()
    accessSignal?.addEventListener('abort', reset, { once: true })
    return () => { generation.current++; accessSignal?.removeEventListener('abort', reset) }
  }, [teamId, accessSignal])
  useEffect(() => {
    const url = file ? URL.createObjectURL(file) : ''
    setPreview(url)
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [file])
  async function save(remove = false) {
    if (busy || (!remove && !file)) return
    if (remove && !window.confirm('팀 로고를 삭제할까요? 기본 표시로 바뀝니다.')) return
    const current = generation.current
    setBusy(true); setError(''); setMessage('')
    try {
      await updateTeamLogo(remove ? null : file)
      if (generation.current !== current) return
      setFile(null)
      if (input.current) input.current.value = ''
      setMessage(remove ? '팀 로고를 삭제했어요.' : '팀 로고를 저장했어요.')
    } catch (cause) {
      if (generation.current !== current || (cause instanceof DOMException && cause.name === 'AbortError')) return
      setError(cause instanceof SessionExpiredError ? '접속이 만료되었어요. 다시 로그인한 뒤 로고를 선택해 주세요.' : cause instanceof Error ? cause.message : '저장하지 못했어요. 다시 시도해 주세요.')
    } finally { if (generation.current === current) setBusy(false) }
  }
  return <section className="team-logo-manager" aria-labelledby="team-logo-heading">
    <h3 id="team-logo-heading">팀 로고</h3>
    <p className="muted">PNG·JPG, 2MB 이하. 정사각형으로 맞춰 저장해요.</p>
    <div className="team-logo-editor">
      {preview ? <img className="team-logo-preview" src={preview} alt="저장할 팀 로고 미리보기" /> : <TeamBadge teamId={teamId} teamName={teamName} className="team-logo-preview" />}
      <div>
        <label>로고 선택<input ref={input} type="file" accept="image/png,image/jpeg" disabled={busy} onChange={event => {
          const selected = event.target.files?.[0]
          setMessage(''); setError(''); setFile(null)
          if (!selected) return
          const problem = validateLogoFile(selected)
          if (problem) { setError(problem); event.target.value = ''; return }
          setFile(selected)
        }} /></label>
        <div className="team-logo-actions">
          <button type="button" disabled={busy || !file} onClick={() => void save()}>{busy ? '처리 중…' : '로고 저장'}</button>
          <button type="button" className="secondary" disabled={busy} onClick={() => void save(true)}>로고 삭제</button>
        </div>
      </div>
    </div>
    {error && <p role="alert" className="error-text">{error}</p>}
    {message && <p role="status">{message}</p>}
  </section>
}
