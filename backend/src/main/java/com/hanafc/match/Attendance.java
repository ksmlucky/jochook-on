package com.hanafc.match;

public enum Attendance {
    PRESENT, LATE, ABSENT, UNCONFIRMED;
    public boolean canPlay() { return this == PRESENT || this == LATE; }
}
