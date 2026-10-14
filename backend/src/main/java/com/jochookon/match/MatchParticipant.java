package com.jochookon.match;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Embeddable
public class MatchParticipant {
    @Column(name = "player_id", nullable = false) private Long playerId;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 16) private Vote vote;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 16) private Attendance attendance;
    protected MatchParticipant() { }
    MatchParticipant(MatchRequest.Participant request) {
        playerId = request.playerId(); vote = request.vote(); attendance = request.attendance();
    }
    public Long getPlayerId() { return playerId; }
    public Vote getVote() { return vote; }
    public Attendance getAttendance() { return attendance; }
}
