package com.jochookon.match;

import com.jochookon.auth.AccountRepository;
import com.jochookon.team.TeamAccessException;
import com.jochookon.team.TeamContext;
import java.util.Objects;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
public class MatchSaveService {
    private final JdbcTemplate jdbc;
    private final AccountRepository accounts;
    private final MatchService matches;
    private final ObjectMapper json;

    public MatchSaveService(JdbcTemplate jdbc, AccountRepository accounts, MatchService matches, ObjectMapper json) {
        this.jdbc = jdbc; this.accounts = accounts; this.matches = matches; this.json = json;
    }

    // The unique receipt lock, match mutation and history are committed together. A competing request
    // waits for this transaction, then either replays the result or claims a rolled-back operation.
    // READ_COMMITTED ensures replay reads the committed winner after waiting for the unique key lock.
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public MatchResponse save(UUID key, Long targetId, MatchRequest request) {
        long teamId = TeamContext.requireTeamId();
        long actorId = actorId();
        String method = targetId == null ? "POST" : "PUT";
        String fingerprint = MatchSaveFingerprint.of(request, json);
        jdbc.update("""
                INSERT INTO match_save_requests(team_id,actor_account_id,request_key,request_method,target_match_id,request_fingerprint)
                VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE request_key=request_key
                """, teamId, actorId, key.toString(), method, targetId, fingerprint);
        var receipt = jdbc.queryForObject("""
                SELECT request_method,target_match_id,request_fingerprint,match_id,result_version
                FROM match_save_requests WHERE team_id=? AND actor_account_id=? AND request_key=? FOR UPDATE
                """, (row, ignored) -> new Receipt(row.getString("request_method"), row.getObject("target_match_id", Long.class),
                row.getString("request_fingerprint"), row.getObject("match_id", Long.class), row.getObject("result_version", Long.class)),
                teamId, actorId, key.toString());
        if (!receipt.method().equals(method) || !Objects.equals(receipt.targetId(), targetId) || !receipt.fingerprint().equals(fingerprint))
            throw new TeamAccessException(409, "REQUEST_CHANGED", "이미 사용한 저장 요청의 내용이 달라졌습니다. 이전 저장 결과를 먼저 확인해 주세요.");
        if (receipt.matchId() != null) {
            var versions = jdbc.query("SELECT version FROM match_records WHERE team_id=? AND id=? FOR UPDATE",
                    (row, ignored) -> row.getLong("version"), teamId, receipt.matchId());
            if (versions.isEmpty() || !Objects.equals(versions.getFirst(), receipt.version()))
                throw new TeamAccessException(409, "SAVE_RESULT_CHANGED", "이 요청은 이미 저장됐지만 경기 기록이 이후 수정되거나 삭제됐습니다. 최신 기록을 확인해 주세요.");
            return matches.get(receipt.matchId());
        }
        var saved = targetId == null ? matches.create(request) : matches.update(targetId, request);
        jdbc.update("""
                UPDATE match_save_requests SET match_id=?,result_version=?,completed_at=CURRENT_TIMESTAMP(6)
                WHERE team_id=? AND actor_account_id=? AND request_key=?
                """, saved.id(), saved.version(), teamId, actorId, key.toString());
        return saved;
    }

    @Transactional(readOnly = true)
    public Status status(UUID key) {
        long teamId = TeamContext.requireTeamId();
        var receipts = jdbc.query("""
                SELECT r.match_id,r.result_version,(m.id IS NOT NULL) AS match_exists
                FROM match_save_requests r LEFT JOIN match_records m ON m.id=r.match_id AND m.team_id=r.team_id
                WHERE r.team_id=? AND r.actor_account_id=? AND r.request_key=? AND r.completed_at IS NOT NULL
                """, (row, ignored) -> new Status(row.getLong("match_id"), row.getLong("result_version"), row.getBoolean("match_exists")),
                teamId, actorId(), key.toString());
        if (receipts.isEmpty()) throw new TeamAccessException(404, "SAVE_REQUEST_NOT_FOUND", "이 계정과 팀에서 완료된 저장 요청을 찾지 못했습니다.");
        return receipts.getFirst();
    }

    private long actorId() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken)
            throw new TeamAccessException(401, "SESSION_EXPIRED", "운영진 계정으로 다시 로그인해 주세요.");
        if (auth.getAuthorities().stream().noneMatch(a -> a.getAuthority().equals("ROLE_DIRECTOR") || a.getAuthority().equals("ROLE_COACH")))
            throw new TeamAccessException(403, "FORBIDDEN", "감독 또는 코치만 저장 결과를 확인할 수 있습니다.");
        return accounts.findByUsername(auth.getName()).filter(a -> a.isEnabled())
                .orElseThrow(() -> new TeamAccessException(401, "SESSION_EXPIRED", "운영진 계정을 확인할 수 없습니다.")).getId();
    }

    public record Status(long matchId, long version, boolean exists) { }
    private record Receipt(String method, Long targetId, String fingerprint, Long matchId, Long version) { }
}
