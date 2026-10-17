import { useEffect, useState } from 'react'
import { SessionExpiredError } from '../auth/api'
import { downloadPlayerTemplate, PlayerRequestError, positionLabels, previewBulk, registerBulk, uploadWorkbook } from './api'
import type { BulkPlayerRow, ImportPreview } from './api'
import { PreferenceFields } from './PreferenceFields'
import { BirthYearField, ClubRoleField } from './ProfileFields'
import { useEditGuard } from '../../app/LeaveGuard'
import { HelpDetails } from '../../app/HelpDetails'
import { useShirtNumbers } from './useShirtNumbers'
import { availableShirtNumbersForRow } from './inputOptions'
import { ShirtNumberAvailability, ShirtNumberField } from './ShirtNumberField'

type Draft = BulkPlayerRow & { key: string }
const emptyRow = (): Draft => ({ key: crypto.randomUUID(), name: '', position: '', shirtNumber: '', joinedOn: '', firstChoice: '', secondChoice: '', thirdChoice: '', birthYear: '', clubRole: '' })

export function BulkPlayerEditor({ initialMode, onSaved, onCancel, onSessionExpired, onBusyChange }: {
  initialMode: 'manual' | 'excel'; onSaved: (count: number) => void; onCancel: () => void; onSessionExpired: () => void
  onBusyChange: (busy: boolean) => void
}) {
  const [rows, setRows] = useState<Draft[]>(initialMode === 'manual' ? [emptyRow(), emptyRow()] : [])
  const shirtOptions = useShirtNumbers(onSessionExpired)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false) }, [busy, onBusyChange])
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [uncertain, setUncertain] = useState(false)
  useEditGuard(!!fileName || rows.some(({ key: _key, ...row }) => Object.values(row).some(value => value.trim())), busy)
  function fail(cause: unknown) {
    if (cause instanceof SessionExpiredError) { onSessionExpired(); return }
    setError(cause instanceof Error ? cause.message : '처리하지 못했어요. 잠시 후 다시 시도해 주세요.')
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
      <p>새 선수는 한 번에 200명까지 등록할 수 있어요. 기존 선수의 정보는 바뀌지 않아요.</p>
    </div>
    {initialMode === 'excel' && <div className="import-tools">
      <button className="secondary-button" onClick={template} disabled={busy}>엑셀 양식 다운로드</button>
      <label className="upload-label">엑셀 파일 선택 (.xlsx, 2MB 이하)<input type="file" accept=".xlsx" disabled={busy || uncertain} onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} /></label>
      {fileName && <p className="field-help">불러온 파일: {fileName}</p>}
    </div>}
    <p className="field-help">이름·기본 포지션·1지망은 필수예요. 포지션이 ‘미확인(UN)’이면 지망은 비워 주세요.</p>
    <p className="field-help">등번호는 1~99번이며, 활동 선수나 함께 등록할 선수와 중복할 수 없어요.</p>
    <ShirtNumberAvailability loading={shirtOptions.loading} error={shirtOptions.error} onRefresh={shirtOptions.refresh} disabled={busy || uncertain} />
    <HelpDetails title={initialMode === 'excel' ? '양식 작성 안내' : '입력 안내'}>
      <ul><li>등번호·생년을 모르면 비워 두세요. 생년은 4자리 연도로 입력해요.</li>
        <li>직책을 비우면 ‘정회원’으로 등록돼요.</li>
        <li>{initialMode === 'excel' ? '파일을 올린 뒤 내용을 검토하고 ‘전체 등록’을 눌러야 저장돼요.' : '선수 행을 추가해 입력한 뒤, 입력 내용 검토 → 전체 등록 순서로 저장해요.'}</li></ul>
    </HelpDetails>
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
          <ShirtNumberField id={`${row.key}-shirt`} value={row.shirtNumber} onChange={shirtNumber => change(i, { shirtNumber })}
            available={shirtOptions.roster === null ? null : availableShirtNumbersForRow(shirtOptions.roster, rows, row.key)} />
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
    {uncertain && <p role="alert" className="import-warning"><strong>등록 여부를 먼저 확인해 주세요.</strong><br />이미 등록됐을 수 있어요. 이 창을 닫고 선수 목록을 확인한 뒤 다시 진행해 주세요.</p>}
    {preview && <p className={preview.valid ? 'save-notice' : 'form-error editor-error'} role="status"><strong>{preview.valid ? `${preview.rows.length}명 검토 완료` : `${preview.rows.filter(row => row.errors.length > 0).length}명의 입력을 확인해 주세요`}</strong><br />{preview.valid ? '아직 저장되지 않았어요. 내용을 확인한 뒤 전체 등록을 눌러 주세요.' : '표시된 오류를 수정한 뒤 다시 검토해 주세요.'}</p>}
    <div className="editor-buttons">
      {!preview?.valid && <button className="primary-button" disabled={busy || uncertain || !rows.length} onClick={validate}>{busy ? '검토 중…' : '입력 내용 검토'}</button>}
      {preview?.valid && <button className="primary-button" disabled={busy || uncertain} onClick={save}>{busy ? '등록 중…' : `${preview.rows.length}명 전체 등록`}</button>}
      <button className="secondary-button" disabled={busy} onClick={onCancel}>{uncertain ? '닫고 목록 확인' : '취소'}</button>
    </div>
  </section>
}
