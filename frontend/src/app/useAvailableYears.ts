import { useEffect, useState } from 'react'
import { SessionExpiredError } from '../features/auth/api'

export function useAvailableYears(load: (signal: AbortSignal) => Promise<number[]>, onSessionExpired: () => void, revision = 0) {
  const [years, setYears] = useState<number[]>([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(false)
    load(controller.signal).then(result => {
      if (!controller.signal.aborted) setYears(result)
    }).catch(cause => {
      if (controller.signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError(true)
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [load, onSessionExpired, revision, retry])
  return { years, error, loading, retry: () => setRetry(value => value + 1) }
}
