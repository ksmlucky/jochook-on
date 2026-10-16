package com.jochookon.config;

import com.jochookon.auth.AccountPrincipal;
import com.jochookon.team.AccessRateLimiter;
import com.jochookon.team.TeamAccessFilter;
import com.jochookon.team.TeamSessionService;
import java.io.IOException;
import java.util.Map;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import tools.jackson.databind.ObjectMapper;

@Configuration(proxyBeanMethods = false)
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, TeamSessionService sessions, AccessRateLimiter limiter, ObjectMapper json) throws Exception {
        return http
                .addFilterBefore(new TeamAccessFilter(sessions, limiter, json), UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/actuator/health", "/api/v1/auth/csrf").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/team-code", "/api/v1/auth/invitation/inspect", "/api/v1/auth/invitation/accept").permitAll()
                        .requestMatchers("/api/v1/auth/me", "/api/v1/auth/team").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/password/change").authenticated()
                        .requestMatchers("/api/v1/service/**").hasRole("SERVICE_ADMIN")
                        .requestMatchers("/api/v1/team/coaches", "/api/v1/team/coaches/**").hasRole("DIRECTOR")
                        .requestMatchers("/api/v1/team/**").hasAnyRole("DIRECTOR", "COACH")
                        .requestMatchers("/api/v1/players/guests", "/api/v1/players/guests/**").hasAnyRole("DIRECTOR", "COACH")
                        .requestMatchers("/api/v1/players/import/**", "/api/v1/players/bulk", "/api/v1/players/bulk/**").hasAnyRole("DIRECTOR", "COACH")
                        .requestMatchers(HttpMethod.GET, "/api/v1/auth/me", "/api/v1/players", "/api/v1/players/{id}").hasAnyRole("DIRECTOR", "COACH", "MEMBER")
                        .requestMatchers(HttpMethod.GET, "/api/v1/stats/players", "/api/v1/stats/players/{playerId}/matches").hasAnyRole("DIRECTOR", "COACH", "MEMBER")
                        .requestMatchers(HttpMethod.GET, "/api/v1/tournaments", "/api/v1/tournaments/years", "/api/v1/tournaments/{id}").hasAnyRole("DIRECTOR", "COACH", "MEMBER")
                        .requestMatchers(HttpMethod.POST, "/api/v1/tournaments").hasAnyRole("DIRECTOR", "COACH")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/tournaments/{id}").hasAnyRole("DIRECTOR", "COACH")
                        .requestMatchers(HttpMethod.POST, "/api/v1/players").hasAnyRole("DIRECTOR", "COACH")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/players/{id}").hasAnyRole("DIRECTOR", "COACH")
                        .requestMatchers("/api/v1/matches/import/**").hasAnyRole("DIRECTOR", "COACH")
                        .requestMatchers(HttpMethod.GET, "/api/v1/matches/history", "/api/v1/matches/history/{eventId}").hasAnyRole("DIRECTOR", "COACH")
                        .requestMatchers(HttpMethod.GET, "/api/v1/matches/save-requests/{key}").hasAnyRole("DIRECTOR", "COACH")
                        .requestMatchers(HttpMethod.GET, "/api/v1/matches", "/api/v1/matches/years", "/api/v1/matches/{id}").hasAnyRole("DIRECTOR", "COACH", "MEMBER")
                        .requestMatchers(HttpMethod.POST, "/api/v1/matches", "/api/v1/matches/lineup-suggestion").hasAnyRole("DIRECTOR", "COACH")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/matches/{id}").hasAnyRole("DIRECTOR", "COACH")
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/matches/{id}").hasAnyRole("DIRECTOR", "COACH")
                        .requestMatchers("/api/v1/admin/**").hasAnyRole("DIRECTOR", "COACH")
                        .requestMatchers("/error").permitAll()
                        .anyRequest().denyAll())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) -> error(json, response, 401, "SESSION_EXPIRED", "접속이 만료되었습니다. 다시 접속해 주세요."))
                        .accessDeniedHandler((request, response, exception) -> error(json, response, 403, "FORBIDDEN", "이 작업에 접근할 수 없습니다.")))
                .requestCache(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                // Spring Security가 비밀번호 확인, 세션 저장, 세션 ID 교체를 처리한다.
                .formLogin(form -> form
                        .loginPage("/")
                        .loginProcessingUrl("/api/v1/auth/login")
                        .successHandler((request, response, authentication) -> {
                            sessions.beginAccount(authentication.getName(), null,
                                    ((AccountPrincipal) authentication.getPrincipal()).credentialVersion(), request, response);
                            response.setStatus(204);
                        })
                        .failureHandler((request, response, exception) -> error(json, response, 401, "INVALID_CREDENTIALS", "아이디 또는 비밀번호를 확인해 주세요."))
                        .permitAll())
                .logout(logout -> logout
                        .logoutUrl("/api/v1/auth/logout")
                        .invalidateHttpSession(true)
                        .clearAuthentication(true)
                        .deleteCookies("JSESSIONID")
                        .logoutSuccessHandler((request, response, authentication) -> response.setStatus(204)))
                .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
    private static void error(ObjectMapper json, HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(json.writeValueAsString(Map.of("code", code, "message", message)));
    }
}
