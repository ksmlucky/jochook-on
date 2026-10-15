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
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "planned_team", length = 1) private MatchTeam plannedTeam;
    protected MatchParticipant() { }
    MatchParticipant(MatchRequest.Participant request) {
        playerId = request.playerId(); vote = request.vote(); attendance = request.attendance(); plannedTeam = request.plannedTeam();
    }
    public Long getPlayerId() { return playerId; }
    public Vote getVote() { return vote; }
    public Attendance getAttendance() { return attendance; }
    public MatchTeam getPlannedTeam() { return plannedTeam; }
}
