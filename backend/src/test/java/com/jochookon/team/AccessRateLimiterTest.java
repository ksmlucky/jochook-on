package com.jochookon.team;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class AccessRateLimiterTest {
    @Test void changingBrowserSessionDoesNotBypassIpLimitAndBlockExpires() {
        var clock = new MutableClock();
        var limiter = new AccessRateLimiter(clock);
        for (int i = 0; i < 10; i++) {
            var request = request("192.0.2.1");
            assertThat(limiter.retryAfter(request)).isZero();
            limiter.failed(request);
        }
        assertThat(limiter.retryAfter(request("192.0.2.1"))).isPositive();
        assertThat(limiter.retryAfter(request("192.0.2.2"))).isZero();
        clock.now = clock.now.plus(Duration.ofMinutes(11));
        assertThat(limiter.retryAfter(request("192.0.2.1"))).isZero();
    }
    @Test void sameBrowserRemainsLimitedWhenIpChanges() {
        var limiter = new AccessRateLimiter(new MutableClock());
        var request = request("192.0.2.3");
        for (int i = 0; i < 10; i++) limiter.failed(request);
        request.setRemoteAddr("192.0.2.4");
        assertThat(limiter.retryAfter(request)).isPositive();
    }
    private static MockHttpServletRequest request(String ip) {
        var request = new MockHttpServletRequest(); request.setRemoteAddr(ip); return request;
    }
    private static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-01-01T00:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return now; }
    }
}
