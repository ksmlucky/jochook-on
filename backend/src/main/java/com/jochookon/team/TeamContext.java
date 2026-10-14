package com.jochookon.team;

/** Validated request scope. Never take this value directly from a request body. */
public final class TeamContext {
    private static final ThreadLocal<Long> CURRENT = new ThreadLocal<>();
    private TeamContext() { }
    public static void set(long teamId) {
        if (teamId < 1) throw new IllegalArgumentException("팀을 확인해 주세요.");
        CURRENT.set(teamId);
    }
    public static long requireTeamId() {
        Long team = CURRENT.get();
        if (team == null) throw new TeamAccessException(403, "TEAM_REQUIRED", "접속할 팀을 선택해 주세요.");
        return team;
    }
    public static void clear() { CURRENT.remove(); }
}
