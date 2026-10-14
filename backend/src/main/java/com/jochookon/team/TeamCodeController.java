package com.jochookon.team;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/team/code")
public class TeamCodeController {
    private final TeamCodeService codes;
    private final TeamSessionService sessions;
    public TeamCodeController(TeamCodeService codes, TeamSessionService sessions) { this.codes = codes; this.sessions = sessions; }
    @GetMapping TeamDtos.CodeState state(HttpServletRequest request) {
        sessions.requireTeamAdmin(request); return codes.state(TeamContext.requireTeamId());
    }
    @GetMapping("/history") List<TeamDtos.CodeHistoryEntry> history(@RequestParam(defaultValue = "20") int limit, HttpServletRequest request) {
        sessions.requireTeamAdmin(request); return codes.history(TeamContext.requireTeamId(), limit);
    }
    @PostMapping TeamDtos.CodeIssued issue(@RequestBody TeamDtos.Version input, HttpServletRequest request) {
        return codes.issue(TeamContext.requireTeamId(), sessions.requireTeamAdmin(request), input.version());
    }
    @DeleteMapping TeamDtos.CodeState revoke(@RequestBody TeamDtos.Version input, HttpServletRequest request) {
        return codes.revoke(TeamContext.requireTeamId(), sessions.requireTeamAdmin(request), input.version());
    }
}
