package com.jochookon.stats;

import com.jochookon.team.TeamContext;
import com.jochookon.match.CompetitionScope;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlayerStatsService {
    static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    static final int MATCH_PAGE_SIZE = 10;
    private final PlayerStatsRepository repository;
    private final Clock clock;
    private final com.jochookon.tournament.TournamentService tournaments;
    @Autowired public PlayerStatsService(PlayerStatsRepository repository, com.jochookon.tournament.TournamentService tournaments) {
        this(repository, tournaments, Clock.system(SEOUL));
    }
    PlayerStatsService(PlayerStatsRepository repository, Clock clock) { this(repository, null, clock); }
    PlayerStatsService(PlayerStatsRepository repository, com.jochookon.tournament.TournamentService tournaments, Clock clock) {
        this.repository = repository; this.tournaments = tournaments; this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PlayerStatsResponse list(Integer year, StatsMatchKind kind, StatsRecordScope recordScope, boolean includeGuests) {
        return list(year, kind, recordScope, includeGuests, null);
    }
    @Transactional(readOnly = true)
    public PlayerStatsResponse list(Integer year, StatsMatchKind kind, StatsRecordScope recordScope, boolean includeGuests, Long tournamentId) {
        return list(year, kind, recordScope, includeGuests, tournamentId, CompetitionScope.ALL);
    }
    @Transactional(readOnly = true)
    public PlayerStatsResponse list(Integer year, StatsMatchKind kind, StatsRecordScope recordScope, boolean includeGuests,
                                     Long tournamentId, CompetitionScope competitionScope) {
        return list(year, kind, recordScope, includeGuests, tournamentId, competitionScope, null);
    }
    @Transactional(readOnly = true)
    public PlayerStatsResponse list(Integer year, StatsMatchKind kind, StatsRecordScope recordScope, boolean includeGuests,
                                     Long tournamentId, CompetitionScope competitionScope, Integer month) {
        return list(year, kind, recordScope, includeGuests, tournamentId, competitionScope, month, null, null);
    }
    @Transactional(readOnly = true)
    public PlayerStatsResponse list(Integer year, StatsMatchKind kind, StatsRecordScope recordScope, boolean includeGuests,
                                     Long tournamentId, CompetitionScope competitionScope, Integer month, String startMonth, String endMonth) {
        return list(year, kind, recordScope, includeGuests, tournamentId, competitionScope, month, startMonth, endMonth, false);
    }
    @Transactional(readOnly = true)
    public PlayerStatsResponse list(Integer year, StatsMatchKind kind, StatsRecordScope recordScope, boolean includeGuests,
                                     Long tournamentId, CompetitionScope competitionScope, Integer month, String startMonth, String endMonth, boolean allTime) {
        long teamId = TeamContext.requireTeamId();
        LocalDate today = LocalDate.now(clock.withZone(SEOUL));
        var filter = PlayerStatsFilter.of(year, kind, recordScope, includeGuests, today, tournamentId, competitionScope, month, startMonth, endMonth, allTime);
        if (tournamentId != null) tournaments.require(tournamentId);
        var counts = repository.counts(teamId, filter);
        return new PlayerStatsResponse(filter.year(), kind, recordScope, includeGuests,
                repository.availableYears(teamId, filter),
                counts.total(), counts.completed(), counts.legacy(), counts.inProgress(), repository.players(teamId, filter), tournamentId, competitionScope, month, startMonth, endMonth,
                counts.goalsAgainst(), counts.scoredExternalMatchCount(), counts.missingExternalScoreCount(), counts.excludedInternalMatchCount(),
                counts.externalMatchCount(), counts.internalMatchCount(), allTime);
    }

    @Transactional(readOnly = true)
    public PlayerMatchStatsResponse matches(long playerId, Integer year, StatsMatchKind kind,
                                            StatsRecordScope recordScope, boolean includeGuests, int page) {
        return matches(playerId, year, kind, recordScope, includeGuests, page, null);
    }
    @Transactional(readOnly = true)
    public PlayerMatchStatsResponse matches(long playerId, Integer year, StatsMatchKind kind,
                                            StatsRecordScope recordScope, boolean includeGuests, int page, Long tournamentId) {
        return matches(playerId, year, kind, recordScope, includeGuests, page, tournamentId, CompetitionScope.ALL);
    }
    @Transactional(readOnly = true)
    public PlayerMatchStatsResponse matches(long playerId, Integer year, StatsMatchKind kind,
                                            StatsRecordScope recordScope, boolean includeGuests, int page, Long tournamentId,
                                            CompetitionScope competitionScope) {
        return matches(playerId, year, kind, recordScope, includeGuests, page, tournamentId, competitionScope, null);
    }
    @Transactional(readOnly = true)
    public PlayerMatchStatsResponse matches(long playerId, Integer year, StatsMatchKind kind,
                                            StatsRecordScope recordScope, boolean includeGuests, int page, Long tournamentId,
                                            CompetitionScope competitionScope, Integer month) {
        return matches(playerId, year, kind, recordScope, includeGuests, page, tournamentId, competitionScope, month, null, null);
    }
    @Transactional(readOnly = true)
    public PlayerMatchStatsResponse matches(long playerId, Integer year, StatsMatchKind kind,
                                            StatsRecordScope recordScope, boolean includeGuests, int page, Long tournamentId,
                                            CompetitionScope competitionScope, Integer month, String startMonth, String endMonth) {
        return matches(playerId, year, kind, recordScope, includeGuests, page, tournamentId, competitionScope, month, startMonth, endMonth, false);
    }
    @Transactional(readOnly = true)
    public PlayerMatchStatsResponse matches(long playerId, Integer year, StatsMatchKind kind,
                                            StatsRecordScope recordScope, boolean includeGuests, int page, Long tournamentId,
                                            CompetitionScope competitionScope, Integer month, String startMonth, String endMonth, boolean allTime) {
        long teamId = TeamContext.requireTeamId();
        if (playerId <= 0 || page < 0) throw new IllegalArgumentException("선수 번호와 페이지를 확인해 주세요.");
        var filter = PlayerStatsFilter.of(year, kind, recordScope, includeGuests, LocalDate.now(clock.withZone(SEOUL)), tournamentId, competitionScope, month, startMonth, endMonth, allTime);
        if (tournamentId != null) tournaments.require(tournamentId);
        var player = repository.player(teamId, filter, playerId).orElseThrow(PlayerStatsNotFoundException::new);
        long total = repository.contributingMatchCount(teamId, filter, playerId);
        // A long offset avoids overflow even for a syntactically valid, very large page number.
        var matches = repository.contributingMatches(teamId, filter, playerId, MATCH_PAGE_SIZE, (long) page * MATCH_PAGE_SIZE);
        return new PlayerMatchStatsResponse(filter.year(), kind, recordScope, includeGuests, player,
                page, MATCH_PAGE_SIZE, total, total / MATCH_PAGE_SIZE + (total % MATCH_PAGE_SIZE == 0 ? 0 : 1), matches, tournamentId, competitionScope, month, startMonth, endMonth, allTime);
    }
}
