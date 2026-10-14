package com.jochookon.team;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.stereotype.Component;

/** Single-instance extra protection for a shared code, independent of client IP/session. */
@Component
public class TeamCodeAttemptLimiter {
    private static final int LIMIT = 10;
    private static final Duration WINDOW = Duration.ofMinutes(10);
    private final Clock clock;
    private final int capacity;
    private final Map<String, Attempt> attempts = new LinkedHashMap<>();
    private static final class Attempt {
        Instant first;
        Instant blockedUntil;
        int failures;
        int inFlight;
        Attempt(Instant now) { first = now; }
    }
    public TeamCodeAttemptLimiter() { this(Clock.systemUTC(), 10_000); }
    TeamCodeAttemptLimiter(Clock clock, int capacity) { this.clock = clock; this.capacity = capacity; }

    <T> T attempt(String normalizedCodeHash, Supplier<T> verification) {
        Attempt ticket = acquire(normalizedCodeHash);
        boolean success = false, invalid = false;
        try {
            T result = verification.get();
            success = true;
            return result;
        } catch (TeamAccessException exception) {
            invalid = exception.code().equals("INVALID_CODE");
            throw exception;
        } finally {
            complete(ticket, success, invalid);
        }
    }
    private synchronized Attempt acquire(String key) {
        Instant now = clock.instant();
        attempts.entrySet().removeIf(entry -> entry.getValue().inFlight == 0
                && !now.isBefore(entry.getValue().blockedUntil == null ? entry.getValue().first.plus(WINDOW) : entry.getValue().blockedUntil));
        Attempt attempt = attempts.get(key);
        if (attempt == null) {
            if (attempts.size() >= capacity) {
                var evictable = attempts.entrySet().stream()
                        .filter(entry -> entry.getValue().inFlight == 0 && entry.getValue().blockedUntil == null).findFirst();
                if (evictable.isEmpty()) throw limited();
                attempts.remove(evictable.get().getKey());
            }
            attempt = new Attempt(now);
            attempts.put(key, attempt);
        }
        if (attempt.blockedUntil != null || attempt.failures + attempt.inFlight >= LIMIT) throw limited();
        attempt.inFlight++;
        return attempt;
    }
    private synchronized void complete(Attempt attempt, boolean success, boolean invalid) {
        Instant now = clock.instant();
        attempt.inFlight--;
        if (success) {
            attempt.failures = 0;
            attempt.first = now;
            attempt.blockedUntil = null;
        } else if (invalid) {
            if (attempt.blockedUntil == null && !now.isBefore(attempt.first.plus(WINDOW))) {
                attempt.failures = 0;
                attempt.first = now;
            }
            attempt.failures++;
            if (attempt.failures >= LIMIT && attempt.blockedUntil == null) attempt.blockedUntil = now.plus(WINDOW);
        }
    }
    synchronized int trackedCodeCount() { return attempts.size(); }
    private static TeamAccessException limited() {
        return new TeamAccessException(429, "RATE_LIMITED", "잠시 후 다시 시도해 주세요.");
    }
}
