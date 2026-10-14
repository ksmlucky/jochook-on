package com.hanafc.player;

public enum PreferredPosition {
    LB, CB, RB, CDM, CM, LW, ST, RW, GK;

    static void validate(PreferredPosition first, PreferredPosition second, PreferredPosition third) {
        if (first == null) throw new IllegalArgumentException("선호 포지션 1지망을 선택해 주세요.");
        if (third != null && second == null) throw new IllegalArgumentException("3지망을 선택하려면 2지망이 필요합니다.");
        if (first == second || first == third || (second != null && second == third)) {
            throw new IllegalArgumentException("선호 포지션은 중복 선택할 수 없습니다.");
        }
    }
}
