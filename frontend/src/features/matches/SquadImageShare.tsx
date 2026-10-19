import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildSquadImage, canShareSquadFile, squadImagePng } from './squadImage'
import type { SquadImageInput } from './squadImage'
import { quarterLabel, quarterNumbers } from './matchFormat'
import type { MatchTeam } from './api'
import { usePitchDialog } from './usePitchDialog'
import './squad-image.css'

export function SquadImageShare(props: SquadImageInput) {
  const [open, setOpen] = useState(false)
  return <><button type="button" className="secondary-button squad-image-trigger" aria-haspopup="dialog" onClick={() => setOpen(true)}>스쿼드 이미지</button>
    {open && <ImageDialog {...props} onClose={() => setOpen(false)} />}</>
}

function ImageDialog(props: SquadImageInput & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const id = useId()
  const [quarter, setQuarter] = useState(props.quarter)
  const [team, setTeam] = useState<MatchTeam>(props.team)
  const [retry, setRetry] = useState(0)
  const [prepared, setPrepared] = useState<{ file: File; url: string; label: string } | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sharing, setSharing] = useState(false)
  usePitchDialog(dialog)
  useEffect(() => {
    let disposed = false; let previewUrl: string | undefined
    setPrepared(null); setError(''); setNotice('')
    void (async () => {
      try {
        const result = buildSquadImage({ ...props, quarter, team })
        const blob = await squadImagePng(result.svg)
        if (disposed) return
        previewUrl = URL.createObjectURL(blob)
        setPrepared({ file: new File([blob], result.filename, { type: 'image/png' }), url: previewUrl, label: result.label })
      } catch (cause) { if (!disposed) setError(cause instanceof Error ? cause.message : '이미지를 만들지 못했어요.') }
    })()
    return () => { disposed = true; if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [props.entries, props.participants, props.teamName, props.playedOn, props.kickoff, props.opponent, props.unsaved, props.internal, props.matchFormat, props.formationA, props.formationB, quarter, team, retry])
  const canShare = !!prepared && canShareSquadFile(prepared.file, navigator)
  async function share() {
    if (!prepared || sharing) return
    setSharing(true); setNotice('')
    try { await navigator.share({ files: [prepared.file] }); setNotice('공유 창을 닫았어요.') }
    catch (cause) { setNotice(cause instanceof DOMException && cause.name === 'AbortError' ? '공유를 취소했어요.' : '공유 창을 열지 못했어요. PNG 다운로드로 저장해 주세요.') }
    finally { setSharing(false) }
  }
  return createPortal(<dialog ref={dialog} className="squad-image-dialog" aria-labelledby={id} onCancel={event => { if (sharing) event.preventDefault(); else { event.preventDefault(); props.onClose() } }}>
    <header><div><h3 id={id}>스쿼드 이미지</h3><p>미리 보고 단톡방에 공유해요.</p></div><button type="button" className="secondary-button" disabled={sharing} onClick={props.onClose}>닫기</button></header>
    <div className="squad-image-selectors"><label>구간<select disabled={sharing} value={quarter} onChange={e => setQuarter(Number(e.target.value))}>{quarterNumbers(props.matchFormat).map(q => <option key={q} value={q}>{quarterLabel(q, props.matchFormat)}</option>)}</select></label>
      {props.internal && <label>팀<select disabled={sharing} value={team} onChange={e => setTeam(e.target.value as MatchTeam)}><option value="A">A팀</option><option value="B">B팀</option></select></label>}</div>
    <p className="field-help">{props.unsaved ? '저장 전 수정 내용이 포함돼요. 이미지 공유는 경기 저장과 별개예요.' : '선택한 구간의 저장된 스쿼드예요.'} 선수 이름과 등번호가 표시돼요.</p>
    {error ? <div role="alert"><p>{error}</p><button type="button" className="secondary-button" onClick={() => setRetry(n => n + 1)}>다시 만들기</button></div> : prepared ? <img className="squad-image-preview" src={prepared.url} alt={`${prepared.label} 스쿼드 공유 이미지`} /> : <p role="status">이미지를 만드는 중이에요.</p>}
    <div className="squad-image-actions">{canShare && <button type="button" className="primary-button" disabled={sharing} onClick={() => void share()}>{sharing ? '공유 중…' : '이미지 공유'}</button>}
      {prepared && <a className="secondary-button" href={prepared.url} download={prepared.file.name}>PNG 다운로드</a>}</div>
    <p className="field-help">{canShare ? '공유 창에서 카카오톡이나 사진 저장을 선택해 주세요.' : 'PNG를 내려받아 카카오톡에 첨부해 주세요. 아이폰에서는 이미지를 길게 눌러 저장할 수도 있어요.'}</p>
    <p role="status" className="squad-image-notice">{notice}</p>
  </dialog>, document.body)
}
