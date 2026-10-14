package com.hanafc.match;

import com.google.ortools.sat.*;

/** 자리 배치 전에 교체·휴식·개인 출전량을 결정해 탐색 크기를 줄인다. */
record QuarterSchedule(int[][] units, int[] totals, int[] substitutes, boolean optimal) {
    static QuarterSchedule calculate(int n, int slots, int seed) {
        // 최대 인원에서는 모든 자리를 매번 반 쿼터씩 나눠야 하므로 해가 정해진다.
        if (n == 4 * slots) {
            int[][] units = new int[n][4]; int[] totals = new int[n]; int[] subs = new int[4];
            java.util.Arrays.fill(totals, 2); java.util.Arrays.fill(subs, slots);
            for (int p = 0; p < n; p++) for (int q = p < n / 2 ? 0 : 1; q < 4; q += 2) units[p][q] = 1;
            return new QuarterSchedule(units, totals, subs, true);
        }
        var model = new CpModel();
        var full = new BoolVar[n][4]; var half = new BoolVar[n][4]; var plays = new BoolVar[n][4];
        var totals = new IntVar[n]; var subs = new IntVar[4];
        var objective = LinearExpr.newBuilder();
        for (int p = 0; p < n; p++) {
            var total = LinearExpr.newBuilder();
            for (int q = 0; q < 4; q++) {
                full[p][q] = model.newBoolVar("f_" + p + "_" + q);
                half[p][q] = model.newBoolVar("h_" + p + "_" + q);
                plays[p][q] = model.newBoolVar("p_" + p + "_" + q);
                model.addEquality(LinearExpr.sum(new IntVar[]{full[p][q], half[p][q]}), plays[p][q]);
                if (q > 0) model.addGreaterOrEqual(LinearExpr.sum(new IntVar[]{plays[p][q - 1], plays[p][q]}), 1);
                total.addTerm(full[p][q], 2).add(half[p][q]);
            }
            totals[p] = model.newIntVar(0, 8, "total_" + p);
            model.addEquality(totals[p], total);
            if (p > 0) model.addGreaterOrEqual(totals[p - 1], totals[p]);
            var square = model.newIntVar(0, 64, "square_" + p);
            model.addMultiplicationEquality(square, totals[p], totals[p]);
            objective.addTerm(square, 100);
        }
        model.addLessOrEqual(LinearExpr.newBuilder().add(totals[0]).addTerm(totals[n - 1], -1), 2);
        for (int q = 0; q < 4; q++) {
            var fullCount = LinearExpr.newBuilder(); var halfCount = LinearExpr.newBuilder();
            for (int p = 0; p < n; p++) { fullCount.add(full[p][q]); halfCount.add(half[p][q]); }
            subs[q] = model.newIntVar(0, slots, "subs_" + q);
            model.addEquality(halfCount, LinearExpr.term(subs[q], 2));
            model.addEquality(LinearExpr.newBuilder().add(fullCount).add(subs[q]), Math.min(n, slots));
            // 균등 평가 64*40*100 + 전체 교체 최대 40건 < 1,000,000.
            objective.addTerm(subs[q], (q < 3 ? 1_000_000 : 0) + 1);
        }
        model.minimize(objective);
        var solver = new CpSolver();
        solver.getParameters().setNumSearchWorkers(1).setRandomSeed(seed).setMaxTimeInSeconds(3).setMaxDeterministicTime(1);
        var status = solver.solve(model);
        if (status != CpSolverStatus.OPTIMAL && status != CpSolverStatus.FEASIBLE)
            throw new IllegalArgumentException("제한 시간 안에 연속 휴식·균등 배분 조건을 만족하는 편성을 찾지 못했습니다. 다시 계산하거나 수동 배치해 주세요.");
        int[][] units = new int[n][4]; int[] resultTotals = new int[n]; int[] substitutes = new int[4];
        for (int p = 0; p < n; p++) {
            resultTotals[p] = (int) solver.value(totals[p]);
            for (int q = 0; q < 4; q++) units[p][q] = solver.booleanValue(full[p][q]) ? 2 : solver.booleanValue(half[p][q]) ? 1 : 0;
        }
        for (int q = 0; q < 4; q++) substitutes[q] = (int) solver.value(subs[q]);
        return new QuarterSchedule(units, resultTotals, substitutes, status == CpSolverStatus.OPTIMAL);
    }
}
