package com.jochookon.match;

/** LEAGUE includes all unlinked matches (external and internal); TOURNAMENT contains linked external matches. */
public enum CompetitionScope {
    ALL, LEAGUE, TOURNAMENT;

    public void validate(Long tournamentId) {
        if (tournamentId != null && tournamentId < 1) throw new IllegalArgumentException("대회 번호를 확인해 주세요.");
        if (this == LEAGUE && tournamentId != null)
            throw new IllegalArgumentException("리그만 조회할 때는 특정 대회를 선택할 수 없습니다.");
    }
}
