package com.jochookon.match;

import java.util.*;

/** Quarter-local goal indexes interleaved with -1 for an external conceded goal; null means unknown. */
final class MatchScoringOrder {
    private MatchScoringOrder() { }

    static List<MatchRequest.Quarter> resolve(List<MatchRequest.Quarter> quarters,
            List<MatchQuarter> savedQuarters, List<MatchGoalEvent> savedEvents) {
        return quarters.stream().map(q -> {
            var order = q.scoringOrder();
            if (order == null && !Boolean.TRUE.equals(q.scoringOrderSpecified())) {
                var old = savedQuarters.stream().filter(s -> s.getNumber() == q.number()).findFirst().orElse(null);
                var oldEvents = old == null || !old.isGoalEventsLinked() ? null : savedEvents.stream()
                        .filter(e -> e.getQuarterNumber() == q.number()).map(MatchGoalEvent::response).toList();
                // An old client may edit goals but knows nothing about the chronological indexes.
                // Preserve only when their source meaning has not changed; never invent an order.
                if (old != null && Objects.equals(q.goalEvents(), oldEvents)
                        && Objects.equals(q.goalsAgainst(), old.getGoalsAgainst())) order = old.getScoringOrder();
            }
            return new MatchRequest.Quarter(q.number(), q.lineup(), q.goalEvents(), q.goalsAgainst(),
                    q.goalsAgainstSpecified(), order, q.scoringOrderSpecified());
        }).toList();
    }

    static void validate(MatchRequest.Quarter q, MatchKind kind) {
        var order = q.scoringOrder();
        if (order == null) return;
        if (q.goalEvents() == null) throw new IllegalArgumentException("득점 순서를 기록하려면 골별 기록을 입력해 주세요.");
        if (kind == MatchKind.EXTERNAL && q.goalsAgainst() == null)
            throw new IllegalArgumentException("득점·실점 순서를 기록하려면 해당 구간의 실점을 입력해 주세요.");
        if (order.size() > 1099) throw new IllegalArgumentException("한 구간의 득점·실점 순서는 최대 1099개입니다.");
        Set<Integer> indexes = new HashSet<>();
        int conceded = 0;
        for (Integer event : order) {
            if (event != null && event == -1) { conceded++; continue; }
            if (event == null || event < 0 || event >= q.goalEvents().size() || !indexes.add(event))
                throw new IllegalArgumentException("득점 순서에 중복되거나 잘못된 골 기록이 있습니다.");
        }
        if (indexes.size() != q.goalEvents().size()) throw new IllegalArgumentException("모든 골 기록을 득점 순서에 한 번씩 포함해 주세요.");
        if (kind == MatchKind.INTERNAL && conceded != 0)
            throw new IllegalArgumentException("자체전 순서는 A·B팀 골 기록으로 입력해 주세요.");
        if (kind == MatchKind.EXTERNAL && conceded != q.goalsAgainst())
            throw new IllegalArgumentException("순서에 입력한 실점 수가 해당 구간의 실점과 다릅니다.");
    }
}
