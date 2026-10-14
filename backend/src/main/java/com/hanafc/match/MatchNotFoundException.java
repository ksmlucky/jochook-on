package com.hanafc.match;

public class MatchNotFoundException extends RuntimeException {
    public MatchNotFoundException() { super("경기 기록을 찾을 수 없습니다."); }
}
