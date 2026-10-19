import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { TournamentEditor } from './TournamentEditor'
import type { Tournament } from './types'

/** Portal avoids nesting the tournament form inside the match form. */
export function CreateTournamentDialog({ onSaved, onClose, onSessionExpired }: {
  onSaved: (value: Tournament) => void; onClose: () => void; onSessionExpired: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const element = dialog.current!
    element.showModal()
    element.querySelector<HTMLInputElement>('input')?.focus()
    return () => { element.close(); previous?.focus() }
  }, [])
  return createPortal(<dialog ref={dialog} className="create-tournament-dialog" aria-label="경기 작성 중 대회 등록"
    onCancel={event => { event.preventDefault(); dialog.current?.querySelector<HTMLButtonElement>('[data-tournament-close]')?.click() }}>
    <p className="field-help">경기 초안은 유지돼요. 대회를 등록하면 현재 경기에 바로 연결해요.</p>
    <TournamentEditor embedded tournament={null} onSaved={onSaved} onClose={onClose} onSessionExpired={onSessionExpired} />
  </dialog>, document.body)
}
