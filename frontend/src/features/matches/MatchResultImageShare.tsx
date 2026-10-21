import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MatchRecord } from './api'
import { buildMatchResultImage } from './matchResultImage'
import { canShareSquadFile, squadImagePng } from './squadImage'
import { usePitchDialog } from './usePitchDialog'
import './squad-image.css'

type Props = { record: MatchRecord; teamName: string }
export function MatchResultImageShare(props: Props) {
  const [open, setOpen] = useState(false)
  return <><button type="button" className="secondary-button" aria-haspopup="dialog" onClick={() => setOpen(true)}>결과 이미지</button>
    {open && <ResultImageDialog {...props} onClose={() => setOpen(false)} />}</>
}

function ResultImageDialog({ record, teamName, onClose }: Props & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const id = useId()
  const [prepared, setPrepared] = useState<{ file: File; url: string; label: string } | null>(null)
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sharing, setSharing] = useState(false)
  usePitchDialog(dialog)
  useEffect(() => {
    let disposed = false
    let url: string | undefined
    setPrepared(null); setError(''); setNotice('')
    void (async () => {
      try {
        const result = buildMatchResultImage({ record, teamName })
        const blob = await squadImagePng(result.svg, { width: result.width, height: result.height })
        if (disposed) return
        url = URL.createObjectURL(blob)
        setPrepared({ file: new File([blob], result.filename, { type: 'image/png' }), url, label: result.label })
      } catch { if (!disposed) setError('결과 이미지를 만들지 못했어요. 다시 시도해 주세요.') }
    })()
    return () => { disposed = true; if (url) URL.revokeObjectURL(url) }
  }, [record, teamName, retry])
  const canShare = !!prepared && canShareSquadFile(prepared.file, navigator)
  async function share() {
    if (!prepared || sharing) return
    setSharing(true); setNotice('')
    try { await navigator.share({ files: [prepared.file] }); setNotice('공유 창을 닫았어요.') }
    catch (cause) { setNotice(cause instanceof DOMException && cause.name === 'AbortError' ? '공유를 취소했어요.' : '공유 창을 열지 못했어요. PNG 다운로드로 저장해 주세요.') }
    finally { setSharing(false) }
  }
  return createPortal(<dialog ref={dialog} className="squad-image-dialog result-image-dialog" aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!sharing) onClose() }}>
    <header><div><h3 id={id}>경기 결과 이미지</h3><p>미리 보고 단톡방에 공유해요.</p></div>
      <button type="button" className="secondary-button" disabled={sharing} onClick={onClose}>닫기</button></header>
    <p className="field-help">저장된 점수와 골별 득점·도움이에요. 선수 이름과 등번호가 포함돼요.</p>
    {error ? <div role="alert"><p>{error}</p><button type="button" className="secondary-button" onClick={() => setRetry(n => n + 1)}>다시 만들기</button></div>
      : prepared ? <img className="squad-image-preview" src={prepared.url} alt={prepared.label} />
        : <p role="status">결과 이미지를 만드는 중이에요.</p>}
    <div className="squad-image-actions">
      {canShare && <button type="button" className="primary-button" disabled={sharing} onClick={() => void share()}>{sharing ? '공유 중…' : '이미지 공유'}</button>}
      {prepared && <a className="secondary-button" href={prepared.url} download={prepared.file.name}>PNG 다운로드</a>}
    </div>
    <p className="field-help">{canShare ? '공유 창에서 카카오톡이나 사진 저장을 선택해 주세요.' : 'PNG를 내려받아 카카오톡에 첨부해 주세요. 아이폰에서는 이미지를 길게 눌러 저장할 수도 있어요.'}</p>
    <p role="status" className="squad-image-notice">{notice}</p>
  </dialog>, document.body)
}
