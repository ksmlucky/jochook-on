package com.jochookon.auth;

import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    @GetMapping("/csrf")
    CsrfResponse csrf(CsrfToken token) {
        return new CsrfResponse(token.getHeaderName(), token.getToken());
    }

    @GetMapping("/me")
    CurrentUser me(Authentication authentication) {
        String role = authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .filter(value -> value.equals("ROLE_ADMIN") || value.equals("ROLE_MEMBER"))
                .map(value -> value.substring(5))
                .findFirst().orElseThrow();
        return new CurrentUser(authentication.getName(), role);
    }

    record CsrfResponse(String headerName, String token) { }
    record CurrentUser(String username, String role) { }
}
