package com.jochookon.team;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class TeamAccessController {
    private final TeamSessionService sessions;
    private final TeamCodeService codes;
    private final TeamManagementService management;
    public TeamAccessController(TeamSessionService sessions, TeamCodeService codes, TeamManagementService management) {
        this.sessions = sessions; this.codes = codes; this.management = management;
    }
    @PostMapping("/team-code")
    TeamDtos.CurrentUser code(@RequestBody TeamDtos.CodeInput input, HttpServletRequest request, HttpServletResponse response) {
        if (request.getAttribute(TeamSessionService.REQUEST_KEY) instanceof TeamSessionService.Access access && access.accountId() != null)
            throw new TeamAccessException(409, "SIGN_OUT_REQUIRED", "운영진 로그아웃 후 회원 코드로 접속해 주세요.");
        var verified = codes.verify(input.code(), input.password());
        return sessions.beginCode(verified.code(), verified.team(), request, response);
    }
    @PostMapping("/team")
    TeamDtos.CurrentUser select(@RequestBody TeamDtos.TeamInput input, HttpServletRequest request) {
        return sessions.select(input.teamId(), request);
    }
    @PostMapping("/invitation/inspect")
    TeamDtos.InvitationInfo inspect(@RequestBody TeamDtos.TokenInput input) { return management.inspect(input.token()); }
    @PostMapping("/invitation/accept")
    TeamDtos.CurrentUser accept(@RequestBody TeamDtos.InvitationAccept input, HttpServletRequest request, HttpServletResponse response) {
        Long accountId = request.getAttribute(TeamSessionService.REQUEST_KEY) instanceof TeamSessionService.Access access ? access.accountId() : null;
        Long authenticatedVersion = accountId == null ? null : sessions.credentialVersion(request);
        var accepted = management.accept(input, accountId);
        return sessions.beginAccount(accepted.username(), accepted.teamId(),
                authenticatedVersion == null ? accepted.credentialVersion() : authenticatedVersion, request, response);
    }
}
