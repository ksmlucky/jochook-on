import { useRef, useState } from 'react'
import { HelpDetails } from '../../app/HelpDetails'
import { SessionExpiredError } from '../auth/api'
import { downloadMatchTemplate, previewMatchWorkbook } from './api'
import type { MatchImportPreview } from './api'
import { formationLabel } from './formations'
import type { Formation } from './formations'
import { matchPeriodSummary } from './matchFormat'
import type { MatchFormat } from './matchFormat'

export function MatchWorkbookImport({ disabled, onBusy, onApply, onSessionExpired, teamLabel, formation = 'F4123', matchFormat }: {
  disabled: boolean; onBusy: (busy: boolean) => void; onApply: (preview: MatchImportPreview) => boolean; onSessionExpired: () => void
  teamLabel?: string; formation?: Formation; matchFormat?: MatchFormat | null
}) {
  const [preview, setPreview] = useState<MatchImportPreview | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const working = useRef(false)
  async function run(action: () => Promise<void>) {
    if (working.current || disabled) return
    working.current = true; onBusy(true); setError(''); setMessage('')
    try { await action() } catch (cause) {
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError(cause instanceof Error ? cause.message : '엑셀 요청을 처리하지 못했습니다.')
    } finally { working.current = false; onBusy(false) }
  }
  return <div className="match-import">
    <h5>{teamLabel && `${teamLabel} · `}엑셀로 {matchPeriodSummary(matchFormat)} 입력</h5>
    <p className="field-help">{formationLabel(formation)} 양식을 받아 작성한 뒤 업로드해 주세요.</p>
    {teamLabel && <p className="field-help">현재 선택한 {teamLabel}에만 반영돼요. 다른 팀은 별도 파일로 입력해 주세요.</p>}
    <HelpDetails title="엑셀 작성 방법"><ul>
      <li>쿼터·포지션별로 이름, 등번호, 총 골, 도움을 입력해 주세요.</li>
      <li>끝의 직접 프리킥·PK 칸에는 총 골에 포함된 득점을 적어 주세요. 두 값의 합은 총 골 이하여야 하며, 승부차기는 제외해요.</li>
      <li>새 양식의 세부 득점 빈칸은 0이에요. 세부 득점 칸이 없는 예전 양식은 같은 쿼터·선수의 기존 세부 기록을 유지해요.</li>
      <li>교체 선수는 같은 자리의 ‘교체’ 행에 적어 주세요.</li>
      <li>교체가 있으면 두 선수는 각각 0.5쿼터, 없으면 선발은 1쿼터로 계산해요.</li>
    </ul></HelpDetails>
    <div className="import-tools"><button type="button" className="secondary-button" disabled={disabled} onClick={() => void run(() => downloadMatchTemplate(formation, matchFormat))}>경기 엑셀 양식 다운로드</button>
      <label className="upload-label">경기 엑셀 업로드 (.xlsx · 2MB 이하)<input type="file" accept=".xlsx" disabled={disabled} onChange={e => {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
        setPreview(null); setFileName(file.name)
        if (file.size > 2 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.xlsx')) { setError('2MB 이하의 .xlsx 파일을 선택해 주세요.'); return }
        void run(async () => { setPreview(await previewMatchWorkbook(file, formation, matchFormat)) })
      }} /></label></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="save-notice" role="status">{message}</p>}
    {preview && <div className="match-import-preview"><p><strong>{fileName}</strong> · {preview.rows.length}행 · {preview.valid ? '검토 통과' : '오류를 수정한 뒤 다시 업로드해 주세요.'}</p>
      <div className="match-table-scroll"><table className="match-table"><thead><tr>{['엑셀 행', '쿼터', '포지션', '구분', '연결 선수', '등번호', '총 골 / 도움', '프리킥 / PK', '검토'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>
        {preview.rows.map(row => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.values[0]}</td><td>{row.values[1]}</td><td>{row.values[2]}</td>
          <td>{row.name ?? row.values[3]}</td><td>{row.shirtNumber ?? (row.values[4] || '없음')}</td><td>{row.values[5] || '0'} / {row.values[6] || '0'}</td><td>{row.values.length < 10 ? '기존 값 유지' : `${row.values[8] || '0'} / ${row.values[9] || '0'}`}</td><td className={row.errors.length ? 'form-error' : ''}>{row.errors.join(' ') || '확인'}</td></tr>)}
      </tbody></table></div>
      <div className="import-warning"><strong>기존 {matchPeriodSummary(matchFormat)} 기록을 교체해요</strong><p>{teamLabel ? `${teamLabel}의 ` : ''}배치·골·도움이 파일 내용으로 바뀌고, 파일에 없는 쿼터는 비워져요. 예전 양식은 같은 쿼터·선수의 프리킥·PK를 유지하고, 새 양식은 두 값도 반영해요.</p><p>{teamLabel && '다른 팀의 기록과 '}투표·출석·기본 정보·코멘트는 유지돼요.</p></div>
      <button type="button" className="secondary-button" disabled={disabled || !preview.valid} onClick={() => {
        if (onApply(preview)) { setPreview(null); setMessage('초안에 반영했어요. 실제 출석을 확인한 뒤 저장해 주세요.') }
      }}>검토한 엑셀로 {matchPeriodSummary(matchFormat)} 초안 교체</button>
    </div>}
  </div>
}
