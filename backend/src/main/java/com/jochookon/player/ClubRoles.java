package com.jochookon.player;

import java.util.List;

/** 팀 내 직책. 로그인 권한과는 별개이다. */
final class ClubRoles {
    static final String DEFAULT = "정회원";
    static final List<String> VALUES = List.of(DEFAULT, "코치", "감독", "총무", "회장");
    private ClubRoles() {}

    static String normalize(String value) {
        String role = value == null || value.isBlank() ? DEFAULT : value.strip();
        if (!VALUES.contains(role)) throw new IllegalArgumentException("직책은 정회원, 코치, 감독, 총무, 회장 중 하나를 선택해 주세요.");
        return role;
    }
}
