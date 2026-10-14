package com.jochookon.team;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Single-instance limiter; forwarded headers are deliberately not used as identity. */
@Component
public class AccessRateLimiter {
    private static final Duration WINDOW = Duration.ofMinutes(10);
    private final Map<String, Attempt> attempts = new HashMap<>();
    private final Clock clock;
    private record Attempt(int failures, Instant first, Instant blockedUntil) { }
    public AccessRateLimiter() { this(Clock.systemUTC()); }
    AccessRateLimiter(Clock clock) { this.clock = clock; }
    public synchronized long retryAfter(HttpServletRequest request) {
        Instant now = clock.instant();
        attempts.entrySet().removeIf(entry -> !now.isBefore(entry.getValue().blockedUntil() == null
                ? entry.getValue().first().plus(WINDOW) : entry.getValue().blockedUntil()));
        long wait = 0;
        for (String key : keys(request)) {
            Attempt attempt = attempts.get(key);
            if (attempt != null && attempt.blockedUntil() != null) wait = Math.max(wait, Duration.between(now, attempt.blockedUntil()).toSeconds() + 1);
        }
        return wait;
    }
    public synchronized void failed(HttpServletRequest request) {
        Instant now = clock.instant();
        for (String key : keys(request)) {
            Attempt old = attempts.get(key);
            if (old == null || (!now.isBefore(old.first().plus(WINDOW)) && old.blockedUntil() == null)) old = new Attempt(0, now, null);
            int count = old.failures() + 1;
            attempts.put(key, new Attempt(count, old.first(), count >= 10 ? now.plus(WINDOW) : null));
        }
    }
    private List<String> keys(HttpServletRequest request) {
        return List.of("ip:" + request.getRemoteAddr(), "session:" + request.getSession(true).getId());
    }
}
