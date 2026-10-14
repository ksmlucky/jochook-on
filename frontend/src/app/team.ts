export type TeamDisplay = Readonly<{ id: number; name: string; description: string | null; status: 'ACTIVE' | 'PENDING' | 'INACTIVE' }>
export type MyTeam = TeamDisplay & { role: import('../features/auth/permissions').TeamRole }
