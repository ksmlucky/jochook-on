package com.jochookon.player;

import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

/** Existing feature tests explicitly request the isolated fixture's team, without bypassing its security filter. */
public final class TeamScopedRequests {
    private TeamScopedRequests() { }
    public static MockHttpServletRequestBuilder get(String url, Object... variables) {
        return MockMvcRequestBuilders.get(url, variables).header("X-Team-Id", "1");
    }
    public static MockHttpServletRequestBuilder post(String url, Object... variables) {
        return MockMvcRequestBuilders.post(url, variables).header("X-Team-Id", "1");
    }
    public static MockHttpServletRequestBuilder put(String url, Object... variables) {
        return MockMvcRequestBuilders.put(url, variables).header("X-Team-Id", "1");
    }
    public static MockMultipartHttpServletRequestBuilder multipart(String url, Object... variables) {
        var request = MockMvcRequestBuilders.multipart(url, variables);
        request.header("X-Team-Id", "1");
        return request;
    }
}
