package com.jochookon.match;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Embeddable
public class PlannedLineup {
    @Column(name = "quarter_number", nullable = false) private int quarterNumber;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 3) private LineupSlot slot;
    @Column(name = "entry_order", nullable = false) private int entryOrder;
    @Column(name = "player_id", nullable = false) private Long playerId;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 1) private MatchTeam team;
    protected PlannedLineup() { }
    PlannedLineup(MatchRequest.PlannedEntry entry) {
        quarterNumber = entry.quarterNumber(); slot = entry.slot(); entryOrder = entry.entryOrder(); playerId = entry.playerId(); team = entry.team();
    }
    MatchRequest.PlannedEntry response() { return new MatchRequest.PlannedEntry(quarterNumber, slot, entryOrder, playerId, team); }
}
