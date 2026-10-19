package com.jochookon.match;

import jakarta.persistence.*;

@Embeddable
public class MatchQuarter {
    @Column(name = "quarter_number", nullable = false) private int number;
    @Column(name = "goal_events_linked", nullable = false) private boolean goalEventsLinked;
    protected MatchQuarter() { }
    MatchQuarter(MatchRequest.Quarter request) { number = request.number(); goalEventsLinked = request.goalEvents() != null; }
    public int getNumber() { return number; }
    public boolean isGoalEventsLinked() { return goalEventsLinked; }
}
