import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FadeToast } from './FadeToast'

type EditState = { dirty: boolean; busy: boolean; recoverable?: boolean }
type LeaveGuard = { update: (id: string, state: EditState | null) => void; confirmLeave: (mode?: 'navigate' | 'logout') => Promise<boolean> }
const GuardContext = createContext<LeaveGuard | null>(null)

export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const editors = useRef(new Map<string, EditState>())
  const answer = useRef<((confirmed: boolean) => void) | null>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [leaveDescription, setLeaveDescription] = useState('')
  const update = useCallback((id: string, state: EditState | null) => {
    if (state) editors.current.set(id, state)
    else editors.current.delete(id)
  }, [])
  const confirmLeave = useCallback(async (mode: 'navigate' | 'logout' = 'navigate') => {
    if (answer.current) return false
    if ([...editors.current.values()].some(editor => editor.busy)) {
      setNotice('요청을 처리하고 있습니다. 완료된 뒤 이동해 주세요.')
      return false
    }
    if (![...editors.current.values()].some(editor => editor.dirty)) return true
    const recoverable = [...editors.current.values()].filter(editor => editor.dirty).every(editor => editor.recoverable)
    setLeaveDescription(mode === 'logout'
      ? '로그아웃하면 보관 중인 초안도 삭제돼요. 내용을 남기려면 먼저 저장해 주세요.'
      : recoverable ? '초안을 보관하고 이동할까요? 같은 탭·계정·팀에서 24시간 안에 이어 쓸 수 있어요.'
        : '이동하면 작성 중인 내용은 사라집니다. 현재 화면에서 계속 작성하거나 저장한 뒤 이동할 수 있어요.')
    previousFocus.current = document.activeElement as HTMLElement | null
    setOpen(true)
    return new Promise<boolean>(resolve => { answer.current = resolve })
  }, [])
  function finish(confirmed: boolean) {
    answer.current?.(confirmed); answer.current = null; setOpen(false)
    if (!confirmed) previousFocus.current?.focus()
  }
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if ([...editors.current.values()].some(editor => editor.dirty || editor.busy)) {
        event.preventDefault(); event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => { window.removeEventListener('beforeunload', warn); answer.current?.(false) }
  }, [])
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer) }, [notice])
  const value = useMemo(() => ({ update, confirmLeave }), [update, confirmLeave])
  return <GuardContext.Provider value={value}>{children}
    <FadeToast message={notice} />
    {open && createPortal(<div className="dialog-backdrop"><div className="leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby="global-leave-title"
      aria-describedby="global-leave-description" onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); finish(false) }
        if (event.key === 'Tab') { event.preventDefault(); const controls = event.currentTarget.querySelectorAll<HTMLButtonElement>('button'); (document.activeElement === controls[0] ? controls[1] : controls[0])?.focus() }
      }}>
      <h3 id="global-leave-title">저장하지 않은 내용이 있어요.</h3>
      <p id="global-leave-description">{leaveDescription}</p>
      <div className="registration-actions"><button className="secondary-button" autoFocus onClick={() => finish(false)}>계속 작성</button><button className="primary-button" onClick={() => finish(true)}>저장 안 하고 이동</button></div>
    </div></div>, document.body)}
  </GuardContext.Provider>
}

export function useLeaveGuard() {
  const guard = useContext(GuardContext)
  if (!guard) throw new Error('LeaveGuardProvider가 필요합니다.')
  return guard
}

export function useEditGuard(dirty: boolean, busy = false, recoverable = false) {
  const { update } = useLeaveGuard()
  const id = useId()
  useEffect(() => { update(id, { dirty, busy, recoverable }); return () => update(id, null) }, [id, dirty, busy, recoverable, update])
}
