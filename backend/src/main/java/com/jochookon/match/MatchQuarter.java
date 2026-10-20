package com.jochookon.match;

import jakarta.persistence.*;

@Embeddable
public class MatchQuarter {
    @Column(name = "quarter_number", nullable = false) private int number;
    @Column(name = "goal_events_linked", nullable = false) private boolean goalEventsLinked;
    @Column(name = "goals_against") private Integer goalsAgainst;
    // Keep a scalar persistent type: Hibernate hashes embeddable collection snapshots,
    // and its converted CollectionJavaType does not support that operation.
    @Column(name = "scoring_order", columnDefinition = "text") private String scoringOrderJson;
    public java.util.List<Integer> getScoringOrder() {
        return new ScoringOrderConverter().convertToEntityAttribute(scoringOrderJson);
    }
    public Integer getGoalsAgainst() { return goalsAgainst; }
    protected MatchQuarter() { }
    MatchQuarter(MatchRequest.Quarter request) {
        number = request.number(); goalEventsLinked = request.goalEvents() != null; goalsAgainst = request.goalsAgainst();
        scoringOrderJson = new ScoringOrderConverter().convertToDatabaseColumn(request.scoringOrder());
    }
    public int getNumber() { return number; }
    public boolean isGoalEventsLinked() { return goalEventsLinked; }
}
