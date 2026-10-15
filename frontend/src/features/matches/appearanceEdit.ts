import type { Appearance, MatchTeam, Participant, Quarter, Slot } from './api'
import { goalBreakdownError, preserveGoalBreakdown } from './goalBreakdown.ts'

/** Change one actual lineup entry without changing attendance, other teams, or the source draft. */
export function editActualAppearance(
  quarters: Quarter[], participants: Participant[], quarterNumber: number, team: MatchTeam,
  slot: Slot, order: 0 | 1, patch: Partial<Appearance> | null,
): Quarter[] {
  const matchingQuarters = quarters.filter(item => item.number === quarterNumber)
  if (!Number.isInteger(quarterNumber) || quarterNumber < 1 || quarterNumber > 4 || matchingQuarters.length !== 1) {
    throw new Error('기록할 쿼터를 다시 선택해 주세요.')
  }
  const quarter = matchingQuarters[0]!
  const atPlace = (entry: Appearance) => entry.team === team && entry.slot === slot && entry.entryOrder === order
  const previous = quarter.lineup.find(atPlace)

  if (patch === null) {
    if (order === 0 && quarter.lineup.some(entry => entry.team === team && entry.slot === slot && entry.entryOrder === 1)) {
      throw new Error('이 자리에는 교체 선수가 있습니다. 교체 기록을 먼저 확인하고 해제한 뒤 선발을 지워 주세요.')
    }
    if (previous && (previous.goals || previous.assists)) {
      throw new Error('이 자리에는 득점·도움 기록이 있습니다. 선수 변경 전에 기록을 확인하고 0으로 정정해 주세요.')
    }
    if (!previous) return quarters
    return quarters.map(item => item === quarter ? { ...item, lineup: item.lineup.filter(entry => !atPlace(entry)) } : item)
  }

  const playerId = Object.hasOwn(patch, 'playerId') ? patch.playerId : previous?.playerId
  if (typeof playerId !== 'number' || !Number.isSafeInteger(playerId) || playerId <= 0) {
    throw new Error('선수를 먼저 선택해 주세요.')
  }
  if (previous && playerId !== previous.playerId && (previous.goals || previous.assists)) {
    throw new Error('이 자리에는 득점·도움 기록이 있습니다. 선수 변경 전에 기록을 확인하고 0으로 정정해 주세요.')
  }
  if (quarter.lineup.some(entry => entry !== previous && entry.playerId === playerId)) {
    throw new Error('같은 쿼터에 이미 배치된 선수입니다. 기존 자리에서 먼저 해제해 주세요.')
  }
  if (order === 1 && !quarter.lineup.some(entry => entry.team === team && entry.slot === slot && entry.entryOrder === 0)) {
    throw new Error('교체 선수를 넣기 전에 같은 자리의 선발 선수를 먼저 선택해 주세요.')
  }
  // Existing imported records may still need attendance confirmation at save time.
  if (playerId !== previous?.playerId && !participants.some(player => player.playerId === playerId && (player.attendance === 'PRESENT' || player.attendance === 'LATE'))) {
    throw new Error('새로 배치할 선수의 실제 출석을 참석 또는 지각으로 먼저 확인해 주세요.')
  }

  const goals = Object.hasOwn(patch, 'goals') ? patch.goals : previous?.goals ?? 0
  const assists = Object.hasOwn(patch, 'assists') ? patch.assists : previous?.assists ?? 0
  if (!validStat(goals) || !validStat(assists)) {
    throw new Error('득점·도움은 0~99 정수로 입력해 주세요.')
  }
  // Identity and location come from the arguments; a patch can only choose a player and stats.
  const next: Appearance = preserveGoalBreakdown({ team, slot, entryOrder: order, playerId, goals, assists,
    ...(patch.freeKickGoals === undefined ? {} : { freeKickGoals: patch.freeKickGoals }),
    ...(patch.penaltyGoals === undefined ? {} : { penaltyGoals: patch.penaltyGoals }),
  }, previous)
  const breakdownError = goalBreakdownError(next)
  if (breakdownError) throw new Error(breakdownError)
  return quarters.map(item => item === quarter ? { ...item, lineup: [...item.lineup.filter(entry => !atPlace(entry)), next] } : item)
}

function validStat(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value <= 99
}
