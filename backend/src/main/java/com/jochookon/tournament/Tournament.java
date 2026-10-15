package com.jochookon.tournament;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "tournaments")
public class Tournament {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "team_id", nullable = false, updatable = false) private Long teamId;
    @Version private Long version;
    @Column(nullable = false, length = 120) private String name;
    @Column(name = "start_date", nullable = false) private LocalDate startDate;
    @Column(name = "end_date", nullable = false) private LocalDate endDate;
    @Column(nullable = false, length = 120) private String venue;
    @Column(nullable = false, length = 80) private String division;
    @Column(nullable = false, length = 3000) private String notes;
    protected Tournament() { }
    static Tournament create(long teamId, TournamentRequest request) {
        var result = new Tournament(); result.teamId = teamId; result.replace(request); return result;
    }
    void replace(TournamentRequest request) {
        request.validate();
        name = request.name().strip(); startDate = request.startDate(); endDate = request.endDate();
        venue = request.venue().strip(); division = request.division().strip(); notes = request.notes().strip();
    }
    public Long getId() { return id; }
    public Long getTeamId() { return teamId; }
    public Long getVersion() { return version; }
    public String getName() { return name; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public String getVenue() { return venue; }
    public String getDivision() { return division; }
    public String getNotes() { return notes; }
}
