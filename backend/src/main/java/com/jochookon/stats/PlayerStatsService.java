package com.jochookon.stats;

import com.jochookon.team.TeamContext;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlayerStatsService {
    static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private final PlayerStatsRepository repository;
    private final Clock clock;
    @Autowired public PlayerStatsService(PlayerStatsRepository repository) { this(repository, Clock.system(SEOUL)); }
    PlayerStatsService(PlayerStatsRepository repository, Clock clock) { this.repository = repository; this.clock = clock; }

    @Transactional(readOnly = true)
    public PlayerStatsResponse list(Integer year, StatsMatchKind kind, StatsRecordScope recordScope, boolean includeGuests) {
        long teamId = TeamContext.requireTeamId();
        LocalDate today = LocalDate.now(clock.withZone(SEOUL));
        var filter = PlayerStatsFilter.of(year, kind, recordScope, includeGuests, today);
        var counts = repository.counts(teamId, filter);
        return new PlayerStatsResponse(filter.year(), kind, recordScope, includeGuests,
                repository.availableYears(teamId, today), counts.total(), counts.completed(), counts.legacy(), counts.inProgress(),
                repository.players(teamId, filter));
    }
}
