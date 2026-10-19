import { useEffect, useRef, useState } from 'react'

export function useTimedNotice() {
  const sequence = useRef(0)
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])
  return { notice, notify: (message: string) => setNotice({ id: ++sequence.current, message }) }
}
