package com.jochookon.match;

public class MatchHistoryNotFoundException extends RuntimeException {
    public MatchHistoryNotFoundException() { super("경기 변경 이력을 찾을 수 없습니다."); }
}
