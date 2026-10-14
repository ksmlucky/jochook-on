package com.jochookon.match;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

final class MatchTestData {
    static MatchRequest request(Long version, List<MatchRequest.Participant> participants, List<MatchRequest.Appearance> first) {
        return new MatchRequest(LocalDate.of(2026, 10, 18), LocalTime.of(7, 0), "검증용 경기장", "검증용 상대", "후반 압박 연습", version, participants,
                List.of(new MatchRequest.Quarter(1, first), new MatchRequest.Quarter(2, List.of()),
                        new MatchRequest.Quarter(3, List.of()), new MatchRequest.Quarter(4, List.of())));
    }
    static MatchRequest.Participant participant(long id, Attendance attendance) { return new MatchRequest.Participant(id, Vote.ATTENDING, attendance); }
    static MatchRequest.Appearance appearance(LineupSlot slot, long id, int goals, int assists) { return new MatchRequest.Appearance(slot, id, goals, assists, 0); }
}
