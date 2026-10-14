package com.jochookon.team;

final class TeamRoles {
    private TeamRoles() { }
    static boolean canWrite(String role) { return "DIRECTOR".equals(role) || "COACH".equals(role); }
    static String assignment(String role) {
        if (role == null) return "DIRECTOR";
        if (!canWrite(role)) throw new TeamAccessException(400, "VALIDATION_ERROR", "감독 또는 코치 권한을 선택해 주세요.");
        return role;
    }
}
