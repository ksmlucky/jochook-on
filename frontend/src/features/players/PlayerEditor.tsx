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
import { availableShirtNumbers, validBirthYearInput, validShirtNumberInput } from './inputOptions'
import { useShirtNumbers } from './useShirtNumbers'
import { ShirtNumberAvailability, ShirtNumberField } from './ShirtNumberField'

export function PlayerEditor({ player, onSaved, onCancel, onSessionExpired, onBusyChange }: {
  player: Player | null
  onSaved: (player: Player) => void
  onCancel: () => void
  onSessionExpired: () => void
  onBusyChange: (busy: boolean) => void
}) {
  const [baseline, setBaseline] = useState(player)
  const shirtOptions = useShirtNumbers(onSessionExpired)
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
    setError(cause instanceof Error ? cause.message : '연결하지 못했어요. 잠시 후 다시 시도해 주세요.')
    if (cause instanceof PlayerRequestError) {
      setFieldErrors(cause.fieldErrors)
      setConflict(cause.status === 409)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || conflict) return
    if (!name.trim() || !position || (position !== 'UN' && !choices[0])) { setError('이름·기본 포지션·1지망을 확인해 주세요. 포지션이 미확인이면 지망은 비워 주세요.'); return }
    if (!validShirtNumberInput(shirtNumber) || !validBirthYearInput(birthYear)) { setError('등번호는 1~99번, 생년은 허용 범위의 4자리 연도로 입력해 주세요. 모르면 비워 두세요.'); return }
    setBusy(true)
    setError('')
    setFieldErrors({})
    try {
      onSaved(await savePlayer({ name: name.trim(), position, shirtNumber: shirtNumber.trim() === '' ? null : Number(shirtNumber), joinedOn: joinedOn || null,
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
      <p>이름·기본 포지션·1지망을 입력해 주세요. 나머지는 나중에 채워도 돼요.</p>
    </div>
    <form onSubmit={submit} aria-busy={busy}>
      <ShirtNumberAvailability loading={shirtOptions.loading} error={shirtOptions.error} onRefresh={shirtOptions.refresh} disabled={busy} />
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
          <p className="field-help">포지션을 모르면 ‘미확인’을 선택해 주세요. 1~3지망은 비워 둬요.</p>
          {fieldErrors.position && <p className="form-error" id="position-error">{fieldErrors.position}</p>}
        </div>
        <ShirtNumberField id="player-shirt" value={shirtNumber} onChange={value => { setShirtNumber(value); setFieldErrors(current => ({ ...current, shirtNumber: '' })) }}
          available={shirtOptions.roster === null ? null : availableShirtNumbers(shirtOptions.roster, baseline?.id)} error={fieldErrors.shirtNumber} />
        <div><label htmlFor="player-joined">가입일 <span>선택</span></label>
          <input id="player-joined" type="date" min="1000-01-01" max="9999-12-31" value={joinedOn} onChange={e => setJoinedOn(e.target.value)} aria-invalid={!!fieldErrors.joinedOn} aria-describedby="joined-help" />
          <p id="joined-help" className={fieldErrors.joinedOn ? 'form-error' : 'field-help'}>{fieldErrors.joinedOn ?? '정확한 날짜를 모르면 비워 두세요.'}</p>
        </div>
        <div><BirthYearField id="player-birth-year" value={birthYear} onChange={setBirthYear} />
          <p className="field-help">{ageDescription(birthYear ? Number(birthYear) : null, seoulYear())} · {seoulYear()}년 − 생년 기준이에요.</p></div>
        <ClubRoleField id="player-club-role" value={clubRole} onChange={setClubRole} />
        <div className="preference-heading"><h4>선호 포지션</h4><p className="field-help">원하는 순서대로 골라 주세요. 2·3지망은 선택이며, 중복할 수 없어요.</p></div>
        <PreferenceFields id="player" values={choices} onChange={setChoices} unknown={position === 'UN'} />
      </fieldset>
      {error && <p role="alert" className="form-error editor-error">{error}</p>}
      {conflict && <div className="conflict-notice"><p>다시 불러오면 지금 입력한 내용이 사라지고, 최근 저장된 정보로 바뀌어요.</p>
        <button type="button" className="secondary-button" disabled={busy} onClick={reload}>최신 정보로 다시 불러오기</button>
      </div>}
      <div className="editor-buttons">
        <button className="primary-button" disabled={busy || conflict}>{busy ? '처리 중…' : player ? '변경 사항 저장' : '선수 등록하기'}</button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>취소</button>
      </div>
    </form>
  </section>
}
