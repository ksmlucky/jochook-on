package com.hanafc.match;

import jakarta.persistence.*;

@Embeddable
public class MatchQuarter {
    @Column(name = "quarter_number", nullable = false) private int number;
    protected MatchQuarter() { }
    MatchQuarter(MatchRequest.Quarter request) { number = request.number(); }
    public int getNumber() { return number; }
}
