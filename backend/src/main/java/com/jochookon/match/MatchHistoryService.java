package com.jochookon.match;

import com.jochookon.auth.AccountRepository;
import com.jochookon.team.TeamAccessException;
import com.jochookon.team.TeamContext;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
@Transactional(readOnly = true)
public class MatchHistoryService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final AccountRepository accounts;
    public MatchHistoryService(JdbcTemplate jdbc, ObjectMapper json, AccountRepository accounts) {
        this.jdbc = jdbc; this.json = json; this.accounts = accounts;
    }
    // The transaction belongs to the match mutation: history must never commit alone.
    @Transactional(propagation = Propagation.MANDATORY)
    public void append(MatchHistory.Action action, MatchResponse before, MatchResponse after) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken)
            throw new TeamAccessException(401, "SESSION_EXPIRED", "운영진 계정으로 다시 로그인해 주세요.");
        var actor = accounts.findByUsername(auth.getName()).filter(a -> a.isEnabled())
                .orElseThrow(() -> new TeamAccessException(401, "SESSION_EXPIRED", "운영진 계정을 확인할 수 없습니다."));
        var match = after == null ? before : after;
        jdbc.update("""
                INSERT INTO match_record_events
                  (team_id, match_id, actor_account_id, actor_username, action, occurred_at, played_on,
                   match_kind, opponent, before_version, after_version, before_snapshot, after_snapshot)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, TeamContext.requireTeamId(), match.id(), actor.getId(), actor.getUsername(), action.name(),
                LocalDateTime.ofInstant(Instant.now(), ZoneOffset.UTC), match.playedOn(), match.kind().name(), match.opponent(),
                before == null ? null : before.version(), after == null ? null : after.version(),
                before == null ? null : json.writeValueAsString(before), after == null ? null : json.writeValueAsString(after));
    }
    public MatchHistory.Page list(int page, int size, Long matchId) {
        String scope = " WHERE team_id=?" + (matchId == null ? "" : " AND match_id=?");
        var args = new ArrayList<Object>(); args.add(TeamContext.requireTeamId());
        if (matchId != null) args.add(matchId);
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM match_record_events" + scope, Long.class, args.toArray());
        args.add(size); args.add((long) page * size);
        var items = jdbc.query("""
                SELECT id, match_id, action, actor_username, occurred_at, played_on, match_kind,
                       opponent, before_version, after_version FROM match_record_events
                """ + scope + " ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?", MatchHistoryService::summary, args.toArray());
        return new MatchHistory.Page(items, page, (int) ((total + size - 1) / size), total);
    }
    public MatchHistory.Detail get(long eventId) {
        var items = jdbc.query("SELECT * FROM match_record_events WHERE team_id=? AND id=?", (row, ignored) -> {
            var event = summary(row, ignored);
            return new MatchHistory.Detail(event.id(), event.matchId(), event.action(), event.actorUsername(), event.occurredAt(),
                    event.playedOn(), event.kind(), event.opponent(), event.beforeVersion(), event.afterVersion(),
                    snapshot(row.getString("before_snapshot")), snapshot(row.getString("after_snapshot")));
        }, TeamContext.requireTeamId(), eventId);
        if (items.isEmpty()) throw new MatchHistoryNotFoundException();
        return items.getFirst();
    }
    private MatchResponse snapshot(String value) { return value == null ? null : json.readValue(value, MatchResponse.class); }
    private static MatchHistory.Summary summary(ResultSet row, int ignored) throws SQLException {
        return new MatchHistory.Summary(row.getLong("id"), row.getLong("match_id"), MatchHistory.Action.valueOf(row.getString("action")),
                row.getString("actor_username"), row.getObject("occurred_at", LocalDateTime.class).toInstant(ZoneOffset.UTC),
                row.getObject("played_on", LocalDate.class), MatchKind.valueOf(row.getString("match_kind")), row.getString("opponent"),
                row.getObject("before_version", Long.class), row.getObject("after_version", Long.class));
    }
}
