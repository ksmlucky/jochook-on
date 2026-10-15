/** Missing values stay missing in payloads and frozen retries; only display/calculation uses zero. */
export interface GoalBreakdown { goals: number; freeKickGoals?: number | null; penaltyGoals?: number | null }

export function goalBreakdownError(value: GoalBreakdown): string | null {
  if ([value.freeKickGoals, value.penaltyGoals].some(n => n != null && (!Number.isInteger(n) || n < 0 || n > 99))) {
    return '직접 프리킥·PK 득점은 0~99 정수로 입력해 주세요.'
  }
  if ((value.freeKickGoals ?? 0) + (value.penaltyGoals ?? 0) > value.goals) {
    return '직접 프리킥과 PK 득점의 합은 총 골 수를 넘을 수 없어요. 총 골 수를 먼저 늘리거나 세부 득점을 줄여 주세요.'
  }
  return null
}

export function generalGoals(value: GoalBreakdown): number {
  return value.goals - (value.freeKickGoals ?? 0) - (value.penaltyGoals ?? 0)
}

export function goalBreakdownText(value: GoalBreakdown): string {
  return `일반 ${generalGoals(value)} · 프리킥 ${value.freeKickGoals ?? 0} · PK ${value.penaltyGoals ?? 0}`
}

export function sumGoalBreakdown(entries: GoalBreakdown[]): { goals: number; freeKickGoals: number; penaltyGoals: number } {
  return entries.reduce<{ goals: number; freeKickGoals: number; penaltyGoals: number }>((total, entry) => ({ goals: total.goals + entry.goals,
    freeKickGoals: total.freeKickGoals + (entry.freeKickGoals ?? 0),
    penaltyGoals: total.penaltyGoals + (entry.penaltyGoals ?? 0),
  }), { goals: 0, freeKickGoals: 0, penaltyGoals: 0 })
}

/** Old workbooks omit the breakdown. Keep even unsaved values by quarter/player, not slot. */
export function preserveGoalBreakdown<T extends GoalBreakdown>(incoming: T, previous?: GoalBreakdown): T {
  const freeKickGoals = incoming.freeKickGoals ?? previous?.freeKickGoals
  const penaltyGoals = incoming.penaltyGoals ?? previous?.penaltyGoals
  return { ...incoming,
    ...(freeKickGoals === undefined ? {} : { freeKickGoals }),
    ...(penaltyGoals === undefined ? {} : { penaltyGoals }),
  }
}
