package com.jochookon.match;

import com.google.ortools.Loader;
import com.google.ortools.sat.*;
import com.jochookon.player.PreferredPosition;
import java.util.*;
import java.util.stream.IntStream;

/** DB와 분리된 편성 정책. 모든 출전량은 반 쿼터를 1로 하는 정수로 계산한다. */
public final class LineupOptimizer {
    public static final String POLICY = "formats-attendance-rest-v4";
    private static final int[] WEIGHTS = {100, 60, 30};
    private static final int[] COMPATIBLE_WEIGHTS = {20, 12, 6};
    public record Candidate(long id, List<PreferredPosition> preferences, long attended, long recorded) {
        boolean keeper() { return preferences.contains(PreferredPosition.GK); }
        boolean known() { return preferences.stream().anyMatch(Objects::nonNull); }
        private PreferredPosition position(LineupSlot slot) {
            return switch (slot) {
                case LCB, CCB, RCB -> PreferredPosition.CB;
                case LCM, RCM -> PreferredPosition.CM;
                case LCDM, RCDM -> PreferredPosition.CDM;
                case LST, RST -> PreferredPosition.ST;
                default -> PreferredPosition.valueOf(slot.name());
            };
        }
        int exactScore(LineupSlot slot) {
            int rank = preferences.indexOf(position(slot));
            return rank < 0 ? 0 : WEIGHTS[rank];
        }
        int score(LineupSlot slot) {
            int exact = exactScore(slot);
            if (exact > 0) return exact;
            // Nearby roles are a fallback, always below any exact third choice.
            var compatible = switch (position(slot)) {
                case LM -> List.of(PreferredPosition.LW, PreferredPosition.LWB);
                case RM -> List.of(PreferredPosition.RW, PreferredPosition.RWB);
                case CAM -> List.of(PreferredPosition.CM);
                case LW -> List.of(PreferredPosition.LM);
                case RW -> List.of(PreferredPosition.RM);
                case CM -> List.of(PreferredPosition.CAM);
                case LB -> List.of(PreferredPosition.LWB);
                case RB -> List.of(PreferredPosition.RWB);
                case LWB -> List.of(PreferredPosition.LB, PreferredPosition.LM);
                case RWB -> List.of(PreferredPosition.RB, PreferredPosition.RM);
                default -> List.<PreferredPosition>of();
            };
            // Several nearby preferences do not stack: use the highest ranked match only.
            for (int rank = 0; rank < preferences.size(); rank++) {
                var choice = preferences.get(rank);
                if (choice != null && compatible.contains(choice)) return COMPATIBLE_WEIGHTS[rank];
            }
            return 0;
        }
    }
    private record GroupResult(List<MatchRequest.PlannedEntry> entries, boolean optimal) { }

    public LineupSuggestion suggest(List<Candidate> input, int seed) {
        return suggest(input, seed, Formation.F4123);
    }
    public LineupSuggestion suggest(List<Candidate> input, int seed, Formation formation) {
        return suggest(input, seed, formation, MatchFormat.FOUR_QUARTERS);
    }
    public LineupSuggestion suggest(List<Candidate> input, int seed, Formation formation, MatchFormat matchFormat) {
        formation = Formation.orDefault(formation);
        matchFormat = MatchFormat.orDefault(matchFormat);
        int periods = matchFormat.periods();
        if (input.isEmpty() || input.size() > 200 || input.stream().map(Candidate::id).distinct().count() != input.size())
            throw new IllegalArgumentException("서로 다른 참석 예정 선수 1~200명을 선택해 주세요.");
        // 호출 입력 순서에 영향을 받지 않으며 출석률 동률은 시드로 정한 순서를 사용한다.
        var ordered = new ArrayList<>(input.stream().sorted(Comparator.comparingLong(Candidate::id)).toList());
        Collections.shuffle(ordered, new Random(seed));
        ordered.sort((a, b) -> Long.compare(b.attended() * Math.max(1, a.recorded()), a.attended() * Math.max(1, b.recorded())));
        var keepers = ordered.stream().filter(Candidate::keeper).toList();
        var field = ordered.stream().filter(p -> p.known() && !p.keeper()).toList();
        if (keepers.size() > 4 || field.size() > 40)
            throw new IllegalArgumentException("GK는 4명, 필드는 40명을 초과하면 1:1 교체로도 두 쿼터 연속 휴식을 막을 수 없습니다. 참석 명단 또는 편성 방식을 조정해 주세요.");
        var warnings = new ArrayList<String>();
        if (input.size() != keepers.size() + field.size()) warnings.add("선호 포지션 미확인 선수는 자동 배치에서 제외했습니다. 포지션을 확인한 뒤 수동 배치해 주세요.");
        if (keepers.isEmpty()) warnings.add("GK 선호가 있는 참석자가 없어 GK 자리를 비웠습니다.");
        if (field.size() < 10) warnings.add("필드 선수가 " + field.size() + "명이라 매 쿼터 " + (10 - field.size()) + "자리가 비어 있습니다.");
        var keeperResult = solve(keepers, List.of(LineupSlot.GK), seed, periods);
        var fieldResult = solve(field, formation.slots().stream().filter(s -> s != LineupSlot.GK).toList(), seed, periods);
        var entries = new ArrayList<>(keeperResult.entries()); entries.addAll(fieldResult.entries());
        entries.sort(Comparator.comparingInt(MatchRequest.PlannedEntry::quarterNumber)
                .thenComparing(MatchRequest.PlannedEntry::slot).thenComparingInt(MatchRequest.PlannedEntry::entryOrder));
        var allocations = input.stream().map(p -> {
            var appearances = entries.stream().filter(e -> e.playerId() == p.id()).toList();
            double total = appearances.stream().mapToDouble(e -> entries.stream().filter(other -> other.quarterNumber() == e.quarterNumber() && other.slot() == e.slot()).count() == 2 ? .5 : 1).sum();
            var rest = IntStream.rangeClosed(1, periods).filter(q -> appearances.stream().noneMatch(e -> e.quarterNumber() == q)).boxed().toList();
            return new LineupSuggestion.Allocation(p.id(), p.keeper() ? "GK" : p.known() ? "FIELD" : "UNKNOWN", p.attended(), p.recorded(), total, rest,
                    (int) appearances.stream().filter(e -> p.exactScore(e.slot()) == 0).count());
        }).sorted(Comparator.comparingLong(LineupSuggestion.Allocation::playerId)).toList();
        long earlySubs = entries.stream().filter(e -> e.entryOrder() == 1 && e.quarterNumber() < periods).count();
        if (earlySubs > 0) warnings.add("연속 휴식 방지와 출전량 차이 1쿼터 이내 조건을 함께 지키기 위해 "
                + (periods == 2 ? "전반에도" : "1~3쿼터에도") + " 교체 " + earlySubs + "건을 배치했습니다.");
        if (allocations.stream().anyMatch(a -> a.nonPreferredAppearances() > 0)) warnings.add("비선호 필드 포지션 배치가 있습니다. LW↔LM·RW↔RM·CM↔CAM·LB↔LWB·LM↔LWB·RB↔RWB·RM↔RWB는 인접 포지션 가중치(20/12/6)로 대체할 수 있으며, 정확한 1~3지망(100/60/30)보다 낮게 평가합니다. 선수별 배분표를 확인하고 조정해 주세요.");
        boolean optimal = keeperResult.optimal() && fieldResult.optimal();
        if (!optimal) warnings.add("계산 시간 안에 찾은 조건 충족 초안입니다. 교체 수와 선호 배치가 최적임을 보장하지는 않습니다.");
        return new LineupSuggestion(POLICY, seed, List.copyOf(entries), allocations, warnings, optimal, formation, matchFormat);
    }

    private GroupResult solve(List<Candidate> people, List<LineupSlot> slots, int seed, int periods) {
        if (people.isEmpty()) return new GroupResult(List.of(), true);
        Loader.loadNativeLibraries();
        int n = people.size(), s = slots.size();
        var schedule = QuarterSchedule.calculate(n, s, seed, periods);
        // 먼저 찾은 유효한 출전표를 자리 탐색의 시작점과 시간 제한 시 대안으로 사용한다.
        int[][] hintSlots = new int[n][periods];
        for (var row : hintSlots) Arrays.fill(row, -1);
        var fallback = new ArrayList<MatchRequest.PlannedEntry>();
        for (int q = 0; q < periods; q++) {
            int k = 0;
            for (int p = 0; p < n; p++) if (schedule.units()[p][q] == 2) {
                hintSlots[p][q] = k;
                fallback.add(new MatchRequest.PlannedEntry(q + 1, slots.get(k++), 0, people.get(p).id()));
            }
            int halfIndex = 0;
            for (int p = 0; p < n; p++) if (schedule.units()[p][q] == 1) {
                hintSlots[p][q] = k + halfIndex / 2;
                fallback.add(new MatchRequest.PlannedEntry(q + 1, slots.get(k + halfIndex / 2), halfIndex % 2, people.get(p).id()));
                halfIndex++;
            }
        }
        var model = new CpModel();
        var full = new BoolVar[n][periods][s];
        var half = new BoolVar[n][periods][s];
        var plays = new BoolVar[n][periods];
        var totals = new IntVar[n];
        var objective = LinearExpr.newBuilder();
        for (int p = 0; p < n; p++) {
            var total = LinearExpr.newBuilder();
            for (int q = 0; q < periods; q++) {
                var count = LinearExpr.newBuilder();
                for (int k = 0; k < s; k++) {
                    full[p][q][k] = model.newBoolVar("full_" + p + "_" + q + "_" + k);
                    half[p][q][k] = model.newBoolVar("half_" + p + "_" + q + "_" + k);
                    count.add(full[p][q][k]).add(half[p][q][k]);
                    model.addHint(full[p][q][k], schedule.units()[p][q] == 2 && hintSlots[p][q] == k ? 1 : 0);
                    model.addHint(half[p][q][k], schedule.units()[p][q] == 1 && hintSlots[p][q] == k ? 1 : 0);
                    total.addTerm(full[p][q][k], 2).add(half[p][q][k]);
                    objective.addTerm(full[p][q][k], -2L * people.get(p).score(slots.get(k)))
                            .addTerm(half[p][q][k], -people.get(p).score(slots.get(k)));
                }
                plays[p][q] = model.newBoolVar("plays_" + p + "_" + q);
                model.addEquality(count, plays[p][q]); // 같은 쿼터에는 한 자리만.
                if (q > 0) model.addGreaterOrEqual(LinearExpr.sum(new IntVar[]{plays[p][q - 1], plays[p][q]}), 1);
            }
            totals[p] = model.newIntVar(0, 2 * periods, "total_" + p);
            model.addEquality(totals[p], total);
            model.addEquality(totals[p], schedule.totals()[p]);
            // 선호 때문에 출석 우선권이 뒤집히지 않게 출전량을 단조롭게 배분한다.
            if (p > 0) model.addGreaterOrEqual(totals[p - 1], totals[p]);
        }
        model.addLessOrEqual(LinearExpr.newBuilder().add(totals[0]).addTerm(totals[n - 1], -1), 2);
        for (int q = 0; q < periods; q++) {
            var filled = LinearExpr.newBuilder();
            var quarterSubs = LinearExpr.newBuilder();
            for (int k = 0; k < s; k++) {
                var substitute = model.newBoolVar("sub_" + q + "_" + k);
                var fullCount = LinearExpr.newBuilder(); var halfCount = LinearExpr.newBuilder();
                for (int p = 0; p < n; p++) { fullCount.add(full[p][q][k]); halfCount.add(half[p][q][k]); }
                model.addLessOrEqual(LinearExpr.newBuilder().add(fullCount).add(substitute), 1);
                model.addEquality(halfCount, LinearExpr.term(substitute, 2));
                filled.add(fullCount).add(substitute);
                quarterSubs.add(substitute);
            }
            model.addEquality(filled, Math.min(n, s));
            model.addEquality(quarterSubs, schedule.substitutes()[q]);
        }
        model.minimize(objective);
        var solver = new CpSolver();
        solver.getParameters().setNumSearchWorkers(1).setRandomSeed(seed).setMaxTimeInSeconds(3).setMaxDeterministicTime(1);
        var status = solver.solve(model);
        if (status != CpSolverStatus.OPTIMAL && status != CpSolverStatus.FEASIBLE)
            return new GroupResult(fallback, false);
        var result = new ArrayList<MatchRequest.PlannedEntry>();
        for (int q = 0; q < periods; q++) for (int k = 0; k < s; k++) {
            int order = 0;
            for (int p = 0; p < n; p++) if (solver.booleanValue(full[p][q][k]) || solver.booleanValue(half[p][q][k]))
                result.add(new MatchRequest.PlannedEntry(q + 1, slots.get(k), order++, people.get(p).id()));
        }
        return new GroupResult(result, schedule.optimal() && status == CpSolverStatus.OPTIMAL);
    }
}
