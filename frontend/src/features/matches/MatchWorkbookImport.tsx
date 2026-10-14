import { useRef, useState } from 'react'
import { SessionExpiredError } from '../auth/api'
import { downloadMatchTemplate, previewMatchWorkbook } from './api'
import type { MatchImportPreview } from './api'

export function MatchWorkbookImport({ disabled, onBusy, onApply, onSessionExpired, teamLabel }: {
  disabled: boolean; onBusy: (busy: boolean) => void; onApply: (preview: MatchImportPreview) => boolean; onSessionExpired: () => void
  teamLabel?: string
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
    <h5>{teamLabel && `${teamLabel} · `}1~4쿼터 엑셀로 한 번에 입력</h5>
    {teamLabel && <p className="field-help">이 파일은 현재 선택한 {teamLabel}에만 반영됩니다. 다른 팀은 팀을 바꾼 뒤 별도 파일로 입력하세요.</p>}
    <p className="field-help">같은 쿼터·포지션의 선발/교체 행에 각 선수의 이름·등번호·득점·도움을 입력하세요. 교체 시 각각 0.5쿼터, 교체 없으면 선발 1쿼터입니다.</p>
    <div className="import-tools"><button type="button" className="secondary-button" disabled={disabled} onClick={() => void run(downloadMatchTemplate)}>경기 엑셀 양식 다운로드</button>
      <label className="upload-label">경기 엑셀 업로드 (.xlsx · 2MB 이하)<input type="file" accept=".xlsx" disabled={disabled} onChange={e => {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
        setPreview(null); setFileName(file.name)
        if (file.size > 2 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.xlsx')) { setError('2MB 이하의 .xlsx 파일을 선택해 주세요.'); return }
        void run(async () => { setPreview(await previewMatchWorkbook(file)) })
      }} /></label></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="save-notice" role="status">{message}</p>}
    {preview && <div className="match-import-preview"><p><strong>{fileName}</strong> · {preview.rows.length}행 · {preview.valid ? '검토 통과' : '오류를 수정한 뒤 다시 업로드해 주세요.'}</p>
      <div className="match-table-scroll"><table className="match-table"><thead><tr>{['엑셀 행', '쿼터', '포지션', '구분', '연결 선수', '등번호', '골 / 도움', '검토'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>
        {preview.rows.map(row => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.values[0]}</td><td>{row.values[1]}</td><td>{row.values[2]}</td>
          <td>{row.name ?? row.values[3]}</td><td>{row.shirtNumber ?? (row.values[4] || '없음')}</td><td>{row.values[5] || '0'} / {row.values[6] || '0'}</td><td className={row.errors.length ? 'form-error' : ''}>{row.errors.join(' ') || '확인'}</td></tr>)}
      </tbody></table></div>
      <p className="import-warning">반영하면 {teamLabel ? `${teamLabel}의 ` : '현재 작성 중인 '}1~4쿼터 배치·스탯 전체가 이 파일의 내용으로 바뀝니다. 파일에 없는 쿼터는 빈 명단이 됩니다. {teamLabel && '다른 팀의 기록과 '}투표·출석·기본 정보·코멘트는 유지합니다.</p>
      <button type="button" className="secondary-button" disabled={disabled || !preview.valid} onClick={() => {
        if (onApply(preview)) { setPreview(null); setMessage('4쿼터 초안에 반영했습니다. 실제 출석을 확인한 뒤 아래 경기 기록 저장을 눌러 주세요.') }
      }}>검토한 엑셀로 4쿼터 초안 교체</button>
    </div>}
  </div>
}
