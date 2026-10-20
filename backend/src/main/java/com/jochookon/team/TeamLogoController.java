package com.jochookon.team;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/teams/current/logo")
public class TeamLogoController {
    private final TeamLogoService logos;
    private final TeamSessionService sessions;
    public TeamLogoController(TeamLogoService logos, TeamSessionService sessions) { this.logos = logos; this.sessions = sessions; }
    @GetMapping
    ResponseEntity<byte[]> get() {
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).header("Cache-Control", "private, no-store")
                .header("X-Content-Type-Options", "nosniff").body(logos.find(TeamContext.requireTeamId()));
    }
    @PutMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void put(@RequestParam("file") MultipartFile file, HttpServletRequest request) {
        sessions.requireDirector(request);
        logos.save(TeamContext.requireTeamId(), file);
    }
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(HttpServletRequest request) {
        sessions.requireDirector(request);
        logos.delete(TeamContext.requireTeamId());
    }
}
