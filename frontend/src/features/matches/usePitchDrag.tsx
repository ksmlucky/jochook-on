import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Slot } from './api'

const HOLD_MS = 380
const MOVE_TOLERANCE = 8
type Target = { slot: Slot; order: 0 | 1 }
type Gesture = { id: number; pointerId: number; x: number; y: number; active: boolean; element: HTMLButtonElement; scope: Element; pointerType: string; timer: ReturnType<typeof setTimeout> }

/** A short tap opens the picker. Scrolling before the hold cancels the gesture. */
export function usePitchDrag(enabled: boolean, onDrop: (id: number, target: Target) => void) {
  const current = useRef<Gesture | null>(null)
  const suppressUntil = useRef(0)
  const [preview, setPreview] = useState<{ id: number; x: number; y: number; target: string | null } | null>(null)
  const reset = () => {
    const gesture = current.current
    current.current = null
    if (gesture) {
      clearTimeout(gesture.timer)
      if (gesture.element.hasPointerCapture(gesture.pointerId)) gesture.element.releasePointerCapture(gesture.pointerId)
    }
    setPreview(null)
  }
  useEffect(() => {
    // Must be non-passive: after the hold, iOS must keep the card under the finger.
    const preventPan = (event: TouchEvent) => { if (current.current?.active && event.cancelable) event.preventDefault() }
    const cancel = () => reset()
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') reset() }
    document.addEventListener('touchmove', preventPan, { passive: false })
    window.addEventListener('blur', cancel)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('touchmove', preventPan)
      window.removeEventListener('blur', cancel)
      document.removeEventListener('keydown', escape)
      if (current.current) clearTimeout(current.current.timer)
      current.current = null
    }
  }, [])
  useEffect(() => { if (!enabled) reset() }, [enabled])
  function targetAt(x: number, y: number) {
    const button = document.elementFromPoint(x, y)?.closest<HTMLButtonElement>('[data-pitch-slot]')
    return button && !button.disabled && current.current?.scope.contains(button) ? button : null
  }
  function move(event: ReactPointerEvent<HTMLButtonElement>) {
    const gesture = current.current
    if (!gesture || event.pointerId !== gesture.pointerId) return
    if (!gesture.active) {
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) <= MOVE_TOLERANCE) return
      if (gesture.pointerType !== 'mouse') { reset(); return }
      clearTimeout(gesture.timer)
      gesture.active = true
      gesture.element.setPointerCapture(gesture.pointerId)
    }
    const target = targetAt(event.clientX, event.clientY)
    setPreview({ id: gesture.id, x: event.clientX, y: event.clientY, target: target ? `${target.dataset.pitchSlot}:${target.dataset.pitchOrder}` : null })
  }
  return {
    preview,
    consumeClick: () => Date.now() < suppressUntil.current,
    bind: (id?: number) => ({
      onContextMenu: (event: React.MouseEvent) => { if (enabled && id != null) event.preventDefault() },
      onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (!enabled || id == null || event.button !== 0 || !event.isPrimary) return
        reset()
        const element = event.currentTarget, scope = element.closest('[data-pitch-drag-scope]')!
        const gesture: Gesture = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, active: false, element, scope, pointerType: event.pointerType,
          timer: setTimeout(() => {
            if (current.current !== gesture) return
            gesture.active = true
            element.setPointerCapture(gesture.pointerId)
            setPreview({ id, x: gesture.x, y: gesture.y, target: null })
          }, HOLD_MS) }
        current.current = gesture
      },
      onPointerMove: move,
      onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
        const gesture = current.current
        if (!gesture || event.pointerId !== gesture.pointerId) return
        const target = gesture.active ? targetAt(event.clientX, event.clientY) : null
        if (gesture.active) suppressUntil.current = Date.now() + 500
        reset()
        if (target) onDrop(gesture.id, { slot: target.dataset.pitchSlot as Slot, order: Number(target.dataset.pitchOrder) as 0 | 1 })
      },
      onPointerCancel: () => { if (current.current?.active) suppressUntil.current = Date.now() + 500; reset() },
      onLostPointerCapture: () => { if (current.current) reset() },
    }),
  }
}

export function PitchDragPreview({ preview, name }: { preview: { x: number; y: number } | null; name: string }) {
  return preview && <div className="pitch-drag-preview" aria-hidden="true" style={{ left: Math.max(8, Math.min(preview.x - 50, window.innerWidth - 112)), top: Math.max(8, preview.y - 64) }}>{name}</div>
}
