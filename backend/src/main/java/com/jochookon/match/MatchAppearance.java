package com.jochookon.match;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Embeddable
public class MatchAppearance {
    @Column(name = "quarter_number", nullable = false) private int quarterNumber;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 3) private LineupSlot slot;
    @Column(name = "player_id", nullable = false) private Long playerId;
    @Column(nullable = false) private int goals;
    @Column(nullable = false) private int assists;
    @Column(name = "entry_order", nullable = false) private int entryOrder;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 1) private MatchTeam team;
    protected MatchAppearance() { }
    MatchAppearance(int quarter, MatchRequest.Appearance request) {
        quarterNumber = quarter; slot = request.slot(); playerId = request.playerId(); goals = request.goals(); assists = request.assists(); entryOrder = request.entryOrder(); team = request.team();
    }
    public int getQuarterNumber() { return quarterNumber; }
    public LineupSlot getSlot() { return slot; }
    public Long getPlayerId() { return playerId; }
    public int getGoals() { return goals; }
    public int getAssists() { return assists; }
    public int getEntryOrder() { return entryOrder; }
    public MatchTeam getTeam() { return team; }
}
