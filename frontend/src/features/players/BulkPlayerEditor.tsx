import { useEffect, useState } from 'react'
import { SessionExpiredError } from '../auth/api'
import { downloadPlayerTemplate, PlayerRequestError, positionLabels, previewBulk, registerBulk, uploadWorkbook } from './api'
import type { BulkPlayerRow, ImportPreview } from './api'
import { PreferenceFields } from './PreferenceFields'
import { BirthYearField, ClubRoleField } from './ProfileFields'
import { useEditGuard } from '../../app/LeaveGuard'

type Draft = BulkPlayerRow & { key: string }
const emptyRow = (): Draft => ({ key: crypto.randomUUID(), name: '', position: '', shirtNumber: '', joinedOn: '', firstChoice: '', secondChoice: '', thirdChoice: '', birthYear: '', clubRole: '' })

export function BulkPlayerEditor({ initialMode, onSaved, onCancel, onSessionExpired, onBusyChange }: {
  initialMode: 'manual' | 'excel'; onSaved: (count: number) => void; onCancel: () => void; onSessionExpired: () => void
  onBusyChange: (busy: boolean) => void
}) {
  const [rows, setRows] = useState<Draft[]>(initialMode === 'manual' ? [emptyRow(), emptyRow()] : [])
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false) }, [busy, onBusyChange])
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [uncertain, setUncertain] = useState(false)
  useEditGuard(!!fileName || rows.some(({ key: _key, ...row }) => Object.values(row).some(value => value.trim())), busy)
  function fail(cause: unknown) {
    if (cause instanceof SessionExpiredError) { onSessionExpired(); return }
    setError(cause instanceof Error ? cause.message : '요청을 처리하지 못했습니다.')
  }
  function change(index: number, patch: Partial<BulkPlayerRow>) {
    setRows(current => current.map((row, i) => i === index ? { ...row, ...patch } : row)); setPreview(null); setError('')
  }
  async function upload(file: File | undefined) {
    if (!file || busy) return
    if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 2 * 1024 * 1024) { setError('2MB 이하의 .xlsx 파일을 선택해 주세요.'); return }
    setBusy(true); setError(''); setPreview(null)
    try {
      const result = await uploadWorkbook(file)
      setRows(result.rows.map(row => ({ ...row.values, key: crypto.randomUUID() })))
      setPreview(result); setFileName(file.name)
    } catch (cause) { fail(cause) }
    finally { setBusy(false) }
  }
  async function validate() {
    setBusy(true); setError('')
    const filled = rows.filter(({ key: _key, ...row }) => Object.values(row).some(value => value.trim()))
    if (!filled.length) { setBusy(false); setError('등록할 선수를 한 명 이상 입력해 주세요.'); return }
    setRows(filled)
    try { setPreview(await previewBulk(filled.map(({ key: _key, ...row }) => row))) } catch (cause) { fail(cause) }
    finally { setBusy(false) }
  }
  async function save() {
    if (!preview?.valid || busy || uncertain) return
    setBusy(true); setError('')
    try { const result = await registerBulk(preview.rows.map(row => row.values)); onSaved(result.length) }
    catch (cause) {
      // 응답을 잃은 경우 이미 저장됐을 수 있어 같은 명단을 자동 재전송하지 않는다.
      if (cause instanceof TypeError || (cause instanceof PlayerRequestError && cause.status >= 500) || (cause instanceof Error && cause.message.includes('등록 결과'))) setUncertain(true)
      fail(cause)
    } finally { setBusy(false) }
  }
  async function template() { try { await downloadPlayerTemplate() } catch (cause) { fail(cause) } }
  return <section className="player-editor bulk-editor" aria-labelledby="bulk-title">
    <div className="editor-heading"><p className="eyebrow muted">SQUAD MANAGEMENT</p><h3 id="bulk-title">{initialMode === 'excel' ? '엑셀로 선수 등록' : '여러 선수 한 번에 등록'}</h3>
      <p>최대 200명 · 내용을 검토한 뒤 전체를 한 번에 등록합니다. 기존 선수를 수정하는 기능은 아닙니다.</p>
    </div>
    <div className="import-tools">
      <button className="secondary-button" onClick={template} disabled={busy}>엑셀 양식 다운로드</button>
      <label className="upload-label">엑셀 파일 선택 (.xlsx, 2MB 이하)<input type="file" accept=".xlsx" disabled={busy || uncertain} onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} /></label>
      {fileName && <p className="field-help">불러온 파일: {fileName}</p>}
    </div>
    <p className="field-help">이름·기본 포지션·1지망 필수. 포지션 미확인(UN)은 지망을 비웁니다. 등번호·생년은 모르면 빈칸으로 두세요. 등번호는 활동 선수와 이번 입력 내에서 중복될 수 없습니다. 생년은 4자리 연도이며, 직책의 빈칸은 정회원으로 등록합니다.</p>
    <fieldset className="bulk-rows" disabled={busy || uncertain}>
      <legend className="sr-only">등록할 선수 목록</legend>
      {rows.map((row, i) => <div className="bulk-row" key={row.key}>
        <div className="bulk-row-heading"><h4>{i + 1}번 선수 {preview && initialMode === 'excel' && fileName ? <small>검토 행 {preview.rows[i]?.rowNumber}</small> : null}</h4>
          <button type="button" className="edit-button" aria-label={`${i + 1}번 선수 행 삭제`} onClick={() => { setRows(current => current.filter(item => item.key !== row.key)); setPreview(null) }}>행 삭제</button></div>
        <div className="player-fields bulk-fields">
          <div><label htmlFor={`${row.key}-name`}>이름 <span>필수</span></label><input id={`${row.key}-name`} maxLength={60} value={row.name} onChange={e => change(i, { name: e.target.value })} /></div>
          <div><label htmlFor={`${row.key}-position`}>기본 포지션 <span>필수</span></label><select id={`${row.key}-position`} value={row.position} onChange={e => change(i, { position: e.target.value, ...(e.target.value === 'UN' ? {firstChoice: '', secondChoice: '', thirdChoice: ''} : {}) })}>
            <option value="">포지션 선택</option>{!['', 'GK', 'DF', 'MF', 'FW', 'UN'].includes(row.position) && <option value={row.position}>잘못된 값: {row.position}</option>}
            {Object.entries(positionLabels).map(([code, label]) => <option key={code} value={code}>{label} ({code})</option>)}
          </select></div>
          <div><label htmlFor={`${row.key}-shirt`}>등번호 <span>선택</span></label><input id={`${row.key}-shirt`} inputMode="numeric" value={row.shirtNumber} onChange={e => change(i, { shirtNumber: e.target.value })} placeholder="미등록" maxLength={20} /></div>
          <div><label htmlFor={`${row.key}-joined`}>가입일 <span>선택</span></label><input id={`${row.key}-joined`} value={row.joinedOn} onChange={e => change(i, { joinedOn: e.target.value })} placeholder="YYYY-MM-DD" maxLength={30} /></div>
          <BirthYearField id={`${row.key}-birth`} value={row.birthYear} onChange={birthYear => change(i, { birthYear })} />
          <ClubRoleField id={`${row.key}-role`} value={row.clubRole} onChange={clubRole => change(i, { clubRole })} />
          <PreferenceFields id={row.key} values={[row.firstChoice, row.secondChoice, row.thirdChoice]} unknown={row.position === 'UN'} onChange={([firstChoice, secondChoice, thirdChoice]) => change(i, { firstChoice, secondChoice, thirdChoice })} />
        </div>
        {preview?.rows[i]?.errors.map((message, j) => <p className="form-error" key={j}>오류: {message}</p>)}
        {preview?.rows[i]?.warnings.map((message, j) => <p className="import-warning" key={j}>확인: {message}</p>)}
      </div>)}
      <button className="secondary-button" disabled={rows.length >= 200} onClick={() => { setRows(current => [...current, emptyRow()]); setPreview(null) }}>+ 선수 행 추가</button>
    </fieldset>
    {error && <p className="form-error editor-error" role="alert">{error}</p>}
    {uncertain && <p role="alert" className="import-warning">저장 결과가 불확실합니다. 닫고 선수 목록을 먼저 확인해 주세요. 중복 등록을 막기 위해 재전송을 멈췄습니다.</p>}
    {preview && <p className={preview.valid ? 'save-notice' : 'form-error editor-error'} role="status">{preview.rows.length}명 검토 · {preview.rows.filter(row => row.errors.length > 0).length}명 오류{preview.valid ? ' · 아직 저장하지 않았습니다.' : ' · 오류를 수정한 뒤 다시 검토하세요.'}</p>}
    <div className="editor-buttons">
      {!preview?.valid && <button className="primary-button" disabled={busy || uncertain || !rows.length} onClick={validate}>{busy ? '검토 중…' : '입력 내용 검토'}</button>}
      {preview?.valid && <button className="primary-button" disabled={busy || uncertain} onClick={save}>{busy ? '등록 중…' : `${preview.rows.length}명 전체 등록`}</button>}
      <button className="secondary-button" disabled={busy} onClick={onCancel}>{uncertain ? '닫고 목록 확인' : '취소'}</button>
    </div>
  </section>
}
