package com.jochookon.team;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/team/coaches")
public class TeamCoachController {
    private final TeamManagementService teams;
    private final TeamSessionService sessions;
    public TeamCoachController(TeamManagementService teams, TeamSessionService sessions) { this.teams = teams; this.sessions = sessions; }
    @GetMapping TeamDtos.TeamDetail list(HttpServletRequest request) {
        return teams.coaches(sessions.requireDirector(request), TeamContext.requireTeamId());
    }
    @PostMapping("/members") TeamDtos.TeamDetail add(@RequestBody TeamDtos.UsernameInput input, HttpServletRequest request) {
        return teams.addCoach(sessions.requireDirector(request), TeamContext.requireTeamId(), input.username());
    }
    @DeleteMapping("/members/{membershipId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void remove(@PathVariable long membershipId, HttpServletRequest request) {
        teams.removeCoach(sessions.requireDirector(request), TeamContext.requireTeamId(), membershipId);
    }
    @PostMapping("/invitations") TeamDtos.InviteIssued invite(@RequestBody TeamDtos.LabelInput input, HttpServletRequest request) {
        return teams.inviteCoach(sessions.requireDirector(request), TeamContext.requireTeamId(), input.label());
    }
    @PostMapping("/invitations/{inviteId}/reissue") TeamDtos.InviteIssued reissue(@PathVariable long inviteId, HttpServletRequest request) {
        return teams.reissueCoach(sessions.requireDirector(request), TeamContext.requireTeamId(), inviteId);
    }
    @DeleteMapping("/invitations/{inviteId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void cancel(@PathVariable long inviteId, HttpServletRequest request) {
        teams.cancelCoach(sessions.requireDirector(request), TeamContext.requireTeamId(), inviteId);
    }
}
