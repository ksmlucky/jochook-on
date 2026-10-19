import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/** Keep the last message mounted briefly after dismissal so the exit can fade too. */
export function FadeToast({ message, identity }: { message: string; identity?: number }) {
  const [shown, setShown] = useState(message)
  const [shownIdentity, setShownIdentity] = useState<string | number>(identity ?? message)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (message) { setShown(message); setShownIdentity(identity ?? message); setLeaving(false); return }
    setLeaving(true)
    const timer = window.setTimeout(() => setShown(''), 300)
    return () => window.clearTimeout(timer)
  }, [message, identity])
  return shown ? createPortal(<div key={shownIdentity} className={`match-save-toast${leaving ? ' is-leaving' : ''}`} role="status" aria-live="polite" aria-atomic="true">
    <span className="match-save-toast-icon" aria-hidden="true">✓</span><span>{shown}</span>
  </div>, document.body) : null
}
