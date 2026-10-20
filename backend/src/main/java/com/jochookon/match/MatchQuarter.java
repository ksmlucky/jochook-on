package com.jochookon.match;

import jakarta.persistence.*;

@Embeddable
public class MatchQuarter {
    @Column(name = "quarter_number", nullable = false) private int number;
    @Column(name = "goal_events_linked", nullable = false) private boolean goalEventsLinked;
    @Column(name = "goals_against") private Integer goalsAgainst;
    @Convert(converter = ScoringOrderConverter.class)
    @Column(name = "scoring_order", columnDefinition = "text") private java.util.List<Integer> scoringOrder;
    public java.util.List<Integer> getScoringOrder() { return scoringOrder == null ? null : java.util.List.copyOf(scoringOrder); }
    public Integer getGoalsAgainst() { return goalsAgainst; }
    protected MatchQuarter() { }
    MatchQuarter(MatchRequest.Quarter request) { number = request.number(); goalEventsLinked = request.goalEvents() != null; goalsAgainst = request.goalsAgainst(); scoringOrder = request.scoringOrder() == null ? null : java.util.List.copyOf(request.scoringOrder()); }
    public int getNumber() { return number; }
    public boolean isGoalEventsLinked() { return goalEventsLinked; }
}
