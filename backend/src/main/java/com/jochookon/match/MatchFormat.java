package com.jochookon.match;

import java.util.Set;

/** Recorded segments keep the same one-quarter credit; this is not a minutes conversion. */
public enum MatchFormat {
    FOUR_QUARTERS(4), TWO_HALVES_30(2);
    private final int periods;
    MatchFormat(int periods) { this.periods = periods; }
    public int periods() { return periods; }
    public Set<Integer> periodNumbers() { return this == TWO_HALVES_30 ? Set.of(1, 2) : Set.of(1, 2, 3, 4); }
    public static MatchFormat orDefault(MatchFormat value) { return value == null ? FOUR_QUARTERS : value; }
}
