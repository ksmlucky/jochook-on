import { useEffect, useState } from 'react'
import { fetchPlayers } from './api'
import type { PlayerPage, PlayerQuery } from './api'
import type { AgeGroup } from './query'
import { SessionExpiredError } from '../auth/api'

type PlayerState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'unauthorized' }
  | { status: 'success'; data: PlayerPage }

export function usePlayers() {
  const [query, setQuery] = useState<PlayerQuery & { page: number }>({ page: 0, size: 20, sort: 'shirtNumber', direction: 'asc' })
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<PlayerState>({ status: 'loading' })
  const [availableAgeGroups, setAvailableAgeGroups] = useState<AgeGroup[]>([])

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    fetchPlayers(query.page, controller.signal, query)
      .then(data => {
        if (controller.signal.aborted) return
        setAvailableAgeGroups(data.availableAgeGroups)
        if (query.ageGroup && !data.availableAgeGroups.includes(query.ageGroup)) {
          setQuery(current => ({ ...current, ageGroup: '', page: 0 }))
          return
        }
        setState({ status: 'success', data })
      })
      .catch(error => {
        if (!controller.signal.aborted) setState({ status: error instanceof SessionExpiredError ? 'unauthorized' : 'error' })
      })
    return () => controller.abort()
  }, [query, attempt])

  return { state, query, availableAgeGroups, setPage: (page: number) => setQuery(current => ({ ...current, page })),
    changeQuery: (patch: Partial<PlayerQuery>) => setQuery(current => ({ ...current, ...patch, page: 0 })),
    retry: () => setAttempt(value => value + 1) }
}
