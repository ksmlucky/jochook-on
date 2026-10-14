package com.jochookon.match;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class MatchHistory {
    private MatchHistory() { }
    public enum Action { CREATED, UPDATED, DELETED }
    public record Summary(long id, long matchId, Action action, String actorUsername, Instant occurredAt,
                          LocalDate playedOn, MatchKind kind, String opponent, Long beforeVersion, Long afterVersion) { }
    public record Detail(long id, long matchId, Action action, String actorUsername, Instant occurredAt,
                         LocalDate playedOn, MatchKind kind, String opponent, Long beforeVersion, Long afterVersion,
                         MatchResponse before, MatchResponse after) { }
    public record Page(List<Summary> items, int page, int totalPages, long totalElements) { }
}
