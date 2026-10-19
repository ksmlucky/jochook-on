import { useEffect } from 'react'
import type { RefObject } from 'react'

let locks = 0
let releaseBody: (() => void) | undefined

/** Nested pitch editors share one lock so closing a child never unlocks the page. */
export function usePitchDialog(dialog: RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const element = dialog.current!
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const parentDialog = trigger?.closest('dialog')
    const parentScroll = parentDialog?.scrollTop ?? 0
    if (locks++ === 0) {
      const x = window.scrollX, y = window.scrollY
      const body = document.body
      const saved = { position: body.style.position, top: body.style.top, left: body.style.left, width: body.style.width, overflow: body.style.overflow }
      Object.assign(body.style, { position: 'fixed', top: `${-y}px`, left: `${-x}px`, width: '100%', overflow: 'hidden' })
      releaseBody = () => {
        Object.assign(body.style, saved)
        window.scrollTo({ left: x, top: y, behavior: 'instant' })
      }
    }
    element.showModal()
    return () => {
      element.close()
      if (--locks === 0) { releaseBody?.(); releaseBody = undefined }
      trigger?.focus({ preventScroll: true })
      if (parentDialog) parentDialog.scrollTop = parentScroll
    }
  }, [dialog])
}
