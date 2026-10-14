package com.hanafc.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration(proxyBeanMethods = false)
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/actuator/health", "/api/v1/auth/csrf").permitAll()
                        .requestMatchers("/api/v1/players/guests", "/api/v1/players/guests/**").hasRole("ADMIN")
                        .requestMatchers("/api/v1/players/import/**", "/api/v1/players/bulk", "/api/v1/players/bulk/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/v1/auth/me", "/api/v1/players", "/api/v1/players/{id}").hasAnyRole("ADMIN", "MEMBER")
                        .requestMatchers(HttpMethod.POST, "/api/v1/players").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/players/{id}").hasRole("ADMIN")
                        .requestMatchers("/api/v1/matches/import/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/v1/matches", "/api/v1/matches/{id}").hasAnyRole("ADMIN", "MEMBER")
                        .requestMatchers(HttpMethod.POST, "/api/v1/matches", "/api/v1/matches/lineup-suggestion").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/matches/{id}").hasRole("ADMIN")
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        .requestMatchers("/error").permitAll()
                        .anyRequest().denyAll())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) -> response.setStatus(401))
                        .accessDeniedHandler((request, response, exception) -> response.setStatus(403)))
                .requestCache(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                // Spring Security가 비밀번호 확인, 세션 저장, 세션 ID 교체를 처리한다.
                .formLogin(form -> form
                        .loginPage("/")
                        .loginProcessingUrl("/api/v1/auth/login")
                        .successHandler((request, response, authentication) -> response.setStatus(204))
                        .failureHandler((request, response, exception) -> response.setStatus(401))
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
}
