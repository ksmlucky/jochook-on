export interface TeamRequestScope { readonly teamId: number; readonly identity: string; readonly controller: AbortController }

// 한 요청이 시작한 팀과 수명을 고정한다. 같은 팀으로 돌아와도 이전 요청은 되살아나지 않는다.
export class TeamScopeStore {
  private current: TeamRequestScope | null = null
  configure(identity: string, teamId: number | null) {
    if (this.current?.identity === identity && this.current.teamId === teamId && !this.current.controller.signal.aborted) return
    this.current?.controller.abort()
    this.current = teamId === null ? null : { teamId, identity, controller: new AbortController() }
  }
  snapshot() { return this.current }
  accepts(scope: TeamRequestScope) { return scope === this.current && !scope.controller.signal.aborted }
  invalidate() { this.current?.controller.abort() }
}
