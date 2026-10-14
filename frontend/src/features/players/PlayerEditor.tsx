import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { SessionExpiredError } from '../auth/api'
import { fetchPlayer, PlayerRequestError, positionLabels, savePlayer } from './api'
import type { Player, Position } from './api'
import type { PreferredPosition } from './api'
import { PreferenceFields } from './PreferenceFields'
import { ageDescription, seoulYear } from './age'
import { BirthYearField, ClubRoleField } from './ProfileFields'
import { useEditGuard } from '../../app/LeaveGuard'

export function PlayerEditor({ player, onSaved, onCancel, onSessionExpired, onBusyChange }: {
  player: Player | null
  onSaved: (player: Player) => void
  onCancel: () => void
  onSessionExpired: () => void
  onBusyChange: (busy: boolean) => void
}) {
  const [baseline, setBaseline] = useState(player)
  const [name, setName] = useState(player?.name ?? '')
  const [position, setPosition] = useState<Position | ''>(player?.position ?? '')
  const [shirtNumber, setShirtNumber] = useState(player?.shirtNumber?.toString() ?? '')
  const [joinedOn, setJoinedOn] = useState(player?.joinedOn ?? '')
  const [birthYear, setBirthYear] = useState(player?.birthYear?.toString() ?? '')
  const [clubRole, setClubRole] = useState(player?.clubRole ?? '정회원')
  const [choices, setChoices] = useState<[string, string, string]>([player?.firstChoice ?? '', player?.secondChoice ?? '', player?.thirdChoice ?? ''])
  const [busy, setBusy] = useState(false)
  useEditGuard(name !== (baseline?.name ?? '') || position !== (baseline?.position ?? '')
    || shirtNumber !== (baseline?.shirtNumber?.toString() ?? '') || joinedOn !== (baseline?.joinedOn ?? '')
    || birthYear !== (baseline?.birthYear?.toString() ?? '') || clubRole !== (baseline?.clubRole ?? '정회원')
    || choices.join('/') !== [baseline?.firstChoice ?? '', baseline?.secondChoice ?? '', baseline?.thirdChoice ?? ''].join('/'), busy)
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false) }, [busy, onBusyChange])
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [conflict, setConflict] = useState(false)
  const nameInput = useRef<HTMLInputElement>(null)
  useEffect(() => { nameInput.current?.focus() }, [])

  function showError(cause: unknown) {
    if (cause instanceof SessionExpiredError) { onSessionExpired(); return }
    setError(cause instanceof Error ? cause.message : '서버에 연결하지 못했습니다. 다시 시도해 주세요.')
    if (cause instanceof PlayerRequestError) {
      setFieldErrors(cause.fieldErrors)
      setConflict(cause.status === 409)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || conflict) return
    if (!name.trim() || !position || (position !== 'UN' && !choices[0])) { setError('이름, 기본 포지션, 선호 포지션 1지망을 입력해 주세요. 포지션 미확인은 지망을 비워 둡니다.'); return }
    setBusy(true)
    setError('')
    setFieldErrors({})
    try {
      onSaved(await savePlayer({ name: name.trim(), position, shirtNumber: shirtNumber === '' ? null : Number(shirtNumber), joinedOn: joinedOn || null,
        birthYear: birthYear === '' ? null : Number(birthYear), clubRole: clubRole.trim() || null,
        firstChoice: choices[0] as PreferredPosition || null, secondChoice: choices[1] as PreferredPosition || null, thirdChoice: choices[2] as PreferredPosition || null }, baseline))
    } catch (cause) { showError(cause) }
    finally { setBusy(false) }
  }

  async function reload() {
    if (!baseline || busy) return
    setBusy(true)
    try {
      const latest = await fetchPlayer(baseline.id)
      setBaseline(latest)
      setName(latest.name)
      setPosition(latest.position)
      setShirtNumber(latest.shirtNumber?.toString() ?? '')
      setJoinedOn(latest.joinedOn ?? '')
      setBirthYear(latest.birthYear?.toString() ?? '')
      setClubRole(latest.clubRole ?? '정회원')
      setChoices([latest.firstChoice ?? '', latest.secondChoice ?? '', latest.thirdChoice ?? ''])
      setConflict(false)
      setFieldErrors({})
      setError('')
      nameInput.current?.focus()
    } catch (cause) { showError(cause) }
    finally { setBusy(false) }
  }

  return <section className="player-editor" aria-labelledby="editor-title">
    <div className="editor-heading"><p className="eyebrow muted">SQUAD MANAGEMENT</p>
      <h3 id="editor-title">{player ? '선수 정보 수정' : '새 선수 등록'}</h3>
      <p>이름·기본 포지션·선호 1지망은 필수입니다. 포지션을 모르면 미확인으로 선택하고 지망을 비워 둡니다. 생년은 선택이며 직책은 기본 정회원입니다.</p>
    </div>
    <form onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy} className="player-fields">
        <legend className="sr-only">선수 기본 정보</legend>
        <div><label htmlFor="player-name">이름 <span>필수</span></label>
          <input ref={nameInput} id="player-name" value={name} onChange={e => setName(e.target.value)} maxLength={60} required autoComplete="off" aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? 'name-error' : undefined} />
          {fieldErrors.name && <p className="form-error" id="name-error">{fieldErrors.name}</p>}
        </div>
        <div><label htmlFor="player-position">기본 포지션 <span>필수</span></label>
          <select id="player-position" value={position} onChange={e => { setPosition(e.target.value as Position); if (e.target.value === 'UN') setChoices(['', '', '']) }} required aria-invalid={!!fieldErrors.position} aria-describedby={fieldErrors.position ? 'position-error' : undefined}>
            <option value="" disabled>포지션 선택</option>
            {Object.entries(positionLabels).map(([value, label]) => <option key={value} value={value}>{label} ({value})</option>)}
          </select>
          {fieldErrors.position && <p className="form-error" id="position-error">{fieldErrors.position}</p>}
        </div>
        <div><label htmlFor="player-shirt">등번호 <span>선택</span></label>
          <input id="player-shirt" type="number" min="1" max="99" step="1" inputMode="numeric" value={shirtNumber} onChange={e => setShirtNumber(e.target.value)} placeholder="미등록" aria-invalid={!!fieldErrors.shirtNumber} aria-describedby="shirt-help" />
          <p id="shirt-help" className={fieldErrors.shirtNumber ? 'form-error' : 'field-help'}>{fieldErrors.shirtNumber ?? '1~99 · 활동 선수끼리 중복 불가. 번호가 없으면 비워 두세요.'}</p>
        </div>
        <div><label htmlFor="player-joined">가입일 <span>선택</span></label>
          <input id="player-joined" type="date" min="1000-01-01" max="9999-12-31" value={joinedOn} onChange={e => setJoinedOn(e.target.value)} aria-invalid={!!fieldErrors.joinedOn} aria-describedby="joined-help" />
          <p id="joined-help" className={fieldErrors.joinedOn ? 'form-error' : 'field-help'}>{fieldErrors.joinedOn ?? '정확한 날짜를 모르면 비워 두세요.'}</p>
        </div>
        <div><BirthYearField id="player-birth-year" value={birthYear} onChange={setBirthYear} />
          <p className="field-help">{ageDescription(birthYear ? Number(birthYear) : null, seoulYear())} ({seoulYear()}년 기준, 만 나이 아님)</p></div>
        <ClubRoleField id="player-club-role" value={clubRole} onChange={setClubRole} />
        <div className="preference-heading"><h4>선호 포지션</h4><p className="field-help">원하는 순서대로 선택하세요. 2·3지망은 선택이며 같은 포지션을 반복할 수 없습니다.</p></div>
        <PreferenceFields id="player" values={choices} onChange={setChoices} unknown={position === 'UN'} />
      </fieldset>
      {error && <p role="alert" className="form-error editor-error">{error}</p>}
      {conflict && <div className="conflict-notice"><p>아래 버튼을 누르면 현재 입력 내용이 서버의 최신 정보로 바뀝니다.</p>
        <button type="button" className="secondary-button" disabled={busy} onClick={reload}>최신 정보로 다시 불러오기</button>
      </div>}
      <div className="editor-buttons">
        <button className="primary-button" disabled={busy || conflict}>{busy ? '처리 중…' : player ? '변경 사항 저장' : '선수 등록하기'}</button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>취소</button>
      </div>
    </form>
  </section>
}
