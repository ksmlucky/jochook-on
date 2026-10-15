import { useCallback, useEffect, useState } from 'react'
import { SessionExpiredError } from '../auth/api'
import { fetchShirtNumberRoster } from './shirtNumbers'
import type { ShirtAssignment } from './inputOptions'

export function useShirtNumbers(onSessionExpired: () => void) {
  const [roster, setRoster] = useState<ShirtAssignment[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => { setRoster(null); setLoading(true); setError(''); setRevision(value => value + 1) }, [])
  useEffect(() => {
    const controller = new AbortController(); setRoster(null); setLoading(true); setError('')
    fetchShirtNumberRoster(controller.signal).then(result => {
      if (!controller.signal.aborted) { setRoster(result); setLoading(false) }
    }).catch(cause => {
      if (controller.signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') return
      setLoading(false)
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError('팀의 사용 중인 등번호를 불러오지 못했어요. 직접 입력은 가능하며 저장할 때 중복을 다시 확인해요.')
    })
    return () => controller.abort()
  }, [revision, onSessionExpired])
  return { roster, loading, error, refresh }
}
