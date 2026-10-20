package com.jochookon.match;

import java.util.*;

/** A null event list is a legacy aggregate quarter; an empty list is an explicitly linked zero-goal quarter. */
final class MatchGoalEvents {
    private MatchGoalEvents() { }

    static List<MatchRequest.Quarter> resolve(List<MatchRequest.Quarter> quarters, MatchKind kind,
            List<MatchQuarter> savedQuarters, List<MatchGoalEvent> savedEvents) {
        var linked = new HashSet<Integer>();
        savedQuarters.stream().filter(MatchQuarter::isGoalEventsLinked).forEach(q -> linked.add(q.getNumber()));
        return quarters.stream().map(q -> {
            boolean preserve = q.goalEvents() == null && linked.contains(q.number());
            List<MatchRequest.GoalEvent> events = preserve ? savedEvents.stream()
                    .filter(e -> e.getQuarterNumber() == q.number()).map(MatchGoalEvent::response).toList() : q.goalEvents();
            if (events == null) return q;
            if (events.size() > 1000) throw new IllegalArgumentException("한 구간의 득점 기록은 최대 1000개입니다.");
            Map<Long, MatchRequest.Appearance> players = new HashMap<>();
            q.lineup().forEach(a -> players.put(a.playerId(), a));
            Map<Long, int[]> totals = new HashMap<>();
            for (var event : events) {
                if (event == null || event.scorerId() == null || event.scorerId() < 1 || event.type() == null
                        || event.team() == null || (event.assistId() != null && event.assistId() < 1))
                    throw new IllegalArgumentException("득점 선수·득점 유형·팀을 확인해 주세요.");
                if (kind == MatchKind.EXTERNAL && event.team() != MatchTeam.A)
                    throw new IllegalArgumentException("외부 경기의 득점 기록에는 우리 팀(A)만 입력할 수 있습니다.");
                var scorer = players.get(event.scorerId());
                if (scorer == null || scorer.team() != event.team())
                    throw new IllegalArgumentException(q.number() + "구간: 득점 선수는 같은 구간·팀의 출전 명단에 있어야 합니다.");
                int[] scored = totals.computeIfAbsent(event.scorerId(), id -> new int[4]);
                scored[0]++;
                if (event.type() == GoalType.FREE_KICK) scored[2]++;
                if (event.type() == GoalType.PENALTY) scored[3]++;
                if (event.assistId() != null) {
                    if (event.scorerId().equals(event.assistId()))
                        throw new IllegalArgumentException("득점 선수와 도움 선수는 서로 달라야 합니다.");
                    if (event.type() != GoalType.NORMAL)
                        throw new IllegalArgumentException("직접 프리킥·페널티킥 득점에는 도움 선수를 지정하지 않습니다.");
                    var helper = players.get(event.assistId());
                    if (helper == null || helper.team() != event.team())
                        throw new IllegalArgumentException(q.number() + "구간: 도움 선수는 같은 구간·팀의 출전 명단에 있어야 합니다.");
                    totals.computeIfAbsent(event.assistId(), id -> new int[4])[1]++;
                }
            }
            var lineup = q.lineup().stream().map(a -> {
                int[] total = totals.getOrDefault(a.playerId(), new int[4]);
                for (int count : total) if (count > 99) throw new IllegalArgumentException("선수별 한 구간의 득점·도움은 각각 99개까지 기록할 수 있습니다.");
                if (preserve && (a.goals() != total[0] || a.assists() != total[1]
                        || (a.freeKickGoals() != null && a.freeKickGoals() != total[2])
                        || (a.penaltyGoals() != null && a.penaltyGoals() != total[3])))
                    throw new IllegalArgumentException("연결된 득점·도움 기록이 있습니다. 최신 화면에서 득점 기록을 수정해 주세요.");
                return new MatchRequest.Appearance(a.slot(), a.playerId(), total[0], total[1], a.entryOrder(), a.team(), total[2], total[3]);
            }).toList();
            return new MatchRequest.Quarter(q.number(), lineup, List.copyOf(events), q.goalsAgainst(), q.goalsAgainstSpecified(), q.scoringOrder(), q.scoringOrderSpecified());
        }).toList();
    }
}
