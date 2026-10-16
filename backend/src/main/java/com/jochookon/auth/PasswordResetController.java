package com.jochookon.auth;

import com.jochookon.team.TeamSessionService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth/password-reset")
public class PasswordResetController {
    private final PasswordResetService resets;
    public PasswordResetController(PasswordResetService resets) { this.resets = resets; }
    @PostMapping("/inspect")
    PasswordResetDtos.Inspected inspect(@RequestBody PasswordResetDtos.TokenInput input) { return resets.inspect(input.token()); }
    @PostMapping("/complete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void complete(@RequestBody PasswordResetDtos.CompleteInput input, HttpServletRequest request) {
        resets.complete(input.token(), input.newPassword());
        if (request.getSession(false) != null) request.getSession(false).invalidate();
        SecurityContextHolder.clearContext();
        request.removeAttribute(TeamSessionService.REQUEST_KEY);
    }
}
