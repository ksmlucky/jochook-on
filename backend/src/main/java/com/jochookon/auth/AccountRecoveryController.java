package com.jochookon.auth;

import com.jochookon.team.TeamSessionService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/service/account-recovery")
public class AccountRecoveryController {
    private final PasswordResetService resets;
    private final TeamSessionService sessions;
    public AccountRecoveryController(PasswordResetService resets, TeamSessionService sessions) { this.resets = resets; this.sessions = sessions; }
    @GetMapping("/accounts")
    List<PasswordResetDtos.RecoveryAccount> accounts(@RequestParam(defaultValue = "") String query, HttpServletRequest request) {
        return resets.accounts(sessions.requireServiceAdmin(request), query);
    }
    @PostMapping("/{accountId}")
    PasswordResetDtos.Issued issue(@PathVariable long accountId, @RequestBody PasswordResetDtos.IssueInput input, HttpServletRequest request) {
        return resets.issue(sessions.requireServiceAdmin(request), accountId, input.identityVerified());
    }
}
