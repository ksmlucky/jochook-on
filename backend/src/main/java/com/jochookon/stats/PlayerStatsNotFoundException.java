package com.jochookon.stats;

class PlayerStatsNotFoundException extends RuntimeException {
    PlayerStatsNotFoundException() { super("현재 조건에서 선수 기록을 찾을 수 없습니다."); }
}
