package com.jochookon.match;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Ordered goal facts; appearance totals are derived from these in linked quarters. */
@Embeddable
public class MatchGoalEvent {
    @Column(name = "quarter_number", nullable = false) private int quarterNumber;
    @Column(name = "scorer_id", nullable = false) private Long scorerId;
    @Column(name = "assist_id") private Long assistId;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "goal_type", nullable = false, length = 16) private GoalType type;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 1) private MatchTeam team;
    protected MatchGoalEvent() { }
    MatchGoalEvent(int quarter, MatchRequest.GoalEvent event) {
        quarterNumber = quarter; scorerId = event.scorerId(); assistId = event.assistId();
        type = event.type(); team = event.team();
    }
    public int getQuarterNumber() { return quarterNumber; }
    public MatchRequest.GoalEvent response() { return new MatchRequest.GoalEvent(scorerId, assistId, type, team); }
}
