package com.jochookon.match;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Embeddable
public class MatchAppearance {
    @Column(name = "quarter_number", nullable = false) private int quarterNumber;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 4) private LineupSlot slot;
    @Column(name = "player_id", nullable = false) private Long playerId;
    @Column(nullable = false) private int goals;
    @Column(nullable = false) private int assists;
    @Column(name = "free_kick_goals", nullable = false) private int freeKickGoals;
    @Column(name = "penalty_goals", nullable = false) private int penaltyGoals;
    @Column(name = "entry_order", nullable = false) private int entryOrder;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 1) private MatchTeam team;
    protected MatchAppearance() { }
    MatchAppearance(int quarter, MatchRequest.Appearance request) {
        quarterNumber = quarter; slot = request.slot(); playerId = request.playerId(); goals = request.goals(); assists = request.assists(); entryOrder = request.entryOrder(); team = request.team();
        freeKickGoals = request.freeKickGoals() == null ? 0 : request.freeKickGoals();
        penaltyGoals = request.penaltyGoals() == null ? 0 : request.penaltyGoals();
    }
    public int getQuarterNumber() { return quarterNumber; }
    public LineupSlot getSlot() { return slot; }
    public Long getPlayerId() { return playerId; }
    public int getGoals() { return goals; }
    public int getAssists() { return assists; }
    public int getFreeKickGoals() { return freeKickGoals; }
    public int getPenaltyGoals() { return penaltyGoals; }
    public int getEntryOrder() { return entryOrder; }
    public MatchTeam getTeam() { return team; }
}
