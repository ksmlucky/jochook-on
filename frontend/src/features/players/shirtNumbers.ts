import { captureTeamScope } from '../auth/teamRequest'
import { fetchGuests, fetchPlayers } from './api'
import type { ShirtAssignment } from './inputOptions'

// Both existing endpoints return active players. No directory filter or current page is reused.
export async function fetchShirtNumberRoster(signal: AbortSignal): Promise<ShirtAssignment[]> {
  const scope = captureTeamScope(), result: ShirtAssignment[] = []
  for (let page = 0; ; page++) {
    const members = await fetchPlayers(page, signal, { size: 100, sort: 'id', direction: 'asc' }, scope)
    result.push(...members.items.map(({ id, shirtNumber }) => ({ id, shirtNumber })))
    if (page + 1 >= members.totalPages) break
  }
  const guests = await fetchGuests(signal, scope)
  return [...result, ...guests.map(({ id, shirtNumber }) => ({ id, shirtNumber }))]
}
