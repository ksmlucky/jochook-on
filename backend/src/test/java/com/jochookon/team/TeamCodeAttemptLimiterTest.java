package com.jochookon.team;

import static org.assertj.core.api.Assertions.*;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class TeamCodeAttemptLimiterTest {
    @Test void tenFailuresTemporarilyBlockOnlyThatCodeAndBlockedRequestsDoNotExtendCooldown() {
        MutableClock clock = new MutableClock();
        var limiter = new TeamCodeAttemptLimiter(clock, 100);
        for (int i = 0; i < 10; i++) fail(limiter, "code-a");
        assertLimited(() -> limiter.attempt("code-a", () -> true));
        assertThat(limiter.attempt("code-b", () -> true)).isTrue();
        clock.advance(Duration.ofMinutes(9));
        assertLimited(() -> limiter.attempt("code-a", () -> true));
        clock.advance(Duration.ofMinutes(1));
        assertThat(limiter.attempt("code-a", () -> true)).isTrue();
    }
    @Test void successfulVerificationResetsFailuresAndInfrastructureErrorsAreNotCounted() {
        var limiter = new TeamCodeAttemptLimiter();
        for (int i = 0; i < 9; i++) fail(limiter, "code");
        assertThat(limiter.attempt("code", () -> true)).isTrue();
        for (int i = 0; i < 9; i++) fail(limiter, "code");
        for (int i = 0; i < 12; i++) assertThatThrownBy(() -> limiter.attempt("code", () -> {
            throw new IllegalStateException("test infrastructure failure");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(limiter.attempt("code", () -> true)).isTrue();
    }
    @Test void storageIsBoundedAndAnActiveBlockCannotBeEvictedByNewCodes() {
        MutableClock clock = new MutableClock();
        var limiter = new TeamCodeAttemptLimiter(clock, 2);
        for (int i = 0; i < 10; i++) fail(limiter, "blocked");
        for (int i = 0; i < 20; i++) fail(limiter, "new-code-" + i);
        assertThat(limiter.trackedCodeCount()).isEqualTo(2);
        assertLimited(() -> limiter.attempt("blocked", () -> true));
        for (int i = 1; i < 10; i++) fail(limiter, "new-code-19");
        assertLimited(() -> limiter.attempt("another-code", () -> true));
        clock.advance(Duration.ofMinutes(10));
        assertThat(limiter.attempt("another-code", () -> true)).isTrue();
    }
    @Test void concurrentChecksReserveTheFailureBudgetBeforeExpensivePasswordWork() throws Exception {
        var limiter = new TeamCodeAttemptLimiter();
        var entered = new CountDownLatch(10);
        var release = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(10)) {
            var tasks = new ArrayList<Future<?>>();
            for (int i = 0; i < 10; i++) tasks.add(executor.submit(() -> {
                assertThatThrownBy(() -> limiter.attempt("code", () -> {
                    entered.countDown();
                    try { if (!release.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("test timeout"); }
                    catch (InterruptedException exception) { Thread.currentThread().interrupt(); throw new IllegalStateException(exception); }
                    throw invalid();
                })).isInstanceOf(TeamAccessException.class).extracting(error -> ((TeamAccessException) error).code()).isEqualTo("INVALID_CODE");
            }));
            try {
                assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();
                assertLimited(() -> limiter.attempt("code", () -> true));
            } finally { release.countDown(); }
            for (var task : tasks) task.get(5, TimeUnit.SECONDS);
            assertLimited(() -> limiter.attempt("code", () -> true));
        }
    }
    private static void fail(TeamCodeAttemptLimiter limiter, String key) {
        assertThatThrownBy(() -> limiter.attempt(key, () -> { throw invalid(); }))
                .isInstanceOf(TeamAccessException.class).extracting(error -> ((TeamAccessException) error).code()).isEqualTo("INVALID_CODE");
    }
    private static TeamAccessException invalid() { return new TeamAccessException(401, "INVALID_CODE", "test failure"); }
    private static void assertLimited(Runnable action) {
        assertThatThrownBy(action::run).isInstanceOf(TeamAccessException.class).satisfies(error -> {
            assertThat(((TeamAccessException) error).status()).isEqualTo(429);
            assertThat(((TeamAccessException) error).code()).isEqualTo("RATE_LIMITED");
        });
    }
    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-01-01T00:00:00Z");
        void advance(Duration duration) { now = now.plus(duration); }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
}
