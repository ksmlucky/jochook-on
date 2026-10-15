package com.jochookon.tournament;

public class TournamentNotFoundException extends RuntimeException {
    public TournamentNotFoundException() { super("현재 팀에서 대회를 찾을 수 없습니다."); }
}
