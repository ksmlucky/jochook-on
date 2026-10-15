package com.jochookon.match;

import java.util.List;

/** A team's formation is shared by its four planned and recorded quarters. */
public enum Formation {
    F4123(LineupSlot.GK, LineupSlot.LB, LineupSlot.LCB, LineupSlot.RCB, LineupSlot.RB, LineupSlot.CDM, LineupSlot.LCM, LineupSlot.RCM, LineupSlot.LW, LineupSlot.ST, LineupSlot.RW),
    F442(LineupSlot.GK, LineupSlot.LB, LineupSlot.LCB, LineupSlot.RCB, LineupSlot.RB, LineupSlot.LM, LineupSlot.LCM, LineupSlot.RCM, LineupSlot.RM, LineupSlot.LST, LineupSlot.RST),
    F4231(LineupSlot.GK, LineupSlot.LB, LineupSlot.LCB, LineupSlot.RCB, LineupSlot.RB, LineupSlot.LCDM, LineupSlot.RCDM, LineupSlot.LM, LineupSlot.CAM, LineupSlot.RM, LineupSlot.ST),
    F4141(LineupSlot.GK, LineupSlot.LB, LineupSlot.LCB, LineupSlot.RCB, LineupSlot.RB, LineupSlot.CDM, LineupSlot.LM, LineupSlot.LCM, LineupSlot.RCM, LineupSlot.RM, LineupSlot.ST),
    F352(LineupSlot.GK, LineupSlot.LCB, LineupSlot.CCB, LineupSlot.RCB, LineupSlot.LWB, LineupSlot.RWB, LineupSlot.CDM, LineupSlot.LCM, LineupSlot.RCM, LineupSlot.LST, LineupSlot.RST),
    F343(LineupSlot.GK, LineupSlot.LCB, LineupSlot.CCB, LineupSlot.RCB, LineupSlot.LWB, LineupSlot.RWB, LineupSlot.LCM, LineupSlot.RCM, LineupSlot.LW, LineupSlot.ST, LineupSlot.RW);

    private final List<LineupSlot> slots;
    Formation(LineupSlot... slots) { this.slots = List.of(slots); }
    public List<LineupSlot> slots() { return slots; }
    public static Formation orDefault(Formation formation) { return formation == null ? F4123 : formation; }
    public void requireSlot(LineupSlot slot) {
        if (slot == null || !slots.contains(slot)) throw new IllegalArgumentException(name().substring(1) + " 포메이션에 없는 자리입니다. 계획·실제 출전 기록의 포지션을 확인해 주세요.");
    }
}
