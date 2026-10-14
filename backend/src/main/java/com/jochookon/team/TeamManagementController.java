package com.jochookon.team;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/service/teams")
public class TeamManagementController {
    private final TeamManagementService teams;
    private final TeamSessionService sessions;
    public TeamManagementController(TeamManagementService teams, TeamSessionService sessions) { this.teams = teams; this.sessions = sessions; }
    @GetMapping List<TeamDtos.Team> list(HttpServletRequest request) { return teams.teams(sessions.requireServiceAdmin(request)); }
    @GetMapping("/{teamId}") TeamDtos.TeamDetail detail(@PathVariable long teamId, HttpServletRequest request) { return teams.detail(sessions.requireServiceAdmin(request), teamId); }
    @PostMapping TeamDtos.TeamCreated create(@RequestBody TeamDtos.CreateTeam input, HttpServletRequest request) { return teams.create(sessions.requireServiceAdmin(request), input); }
    @PostMapping("/{teamId}/members") TeamDtos.TeamDetail addMember(@PathVariable long teamId, @RequestBody TeamDtos.UsernameInput input, HttpServletRequest request) {
        return teams.addMember(sessions.requireServiceAdmin(request), teamId, input.username(), input.role());
    }
    @DeleteMapping("/{teamId}/members/{membershipId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void removeMember(@PathVariable long teamId, @PathVariable long membershipId, HttpServletRequest request) { teams.removeMember(sessions.requireServiceAdmin(request), teamId, membershipId); }
    @PostMapping("/{teamId}/invitations") TeamDtos.InviteIssued invite(@PathVariable long teamId, @RequestBody TeamDtos.LabelInput input, HttpServletRequest request) {
        return teams.invite(sessions.requireServiceAdmin(request), teamId, input.label(), input.role());
    }
    @PostMapping("/{teamId}/invitations/{inviteId}/reissue") TeamDtos.InviteIssued reissue(@PathVariable long teamId, @PathVariable long inviteId, HttpServletRequest request) {
        return teams.reissue(sessions.requireServiceAdmin(request), teamId, inviteId);
    }
    @DeleteMapping("/{teamId}/invitations/{inviteId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void cancel(@PathVariable long teamId, @PathVariable long inviteId, HttpServletRequest request) { teams.cancel(sessions.requireServiceAdmin(request), teamId, inviteId); }
}
