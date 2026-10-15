package com.jochookon.stats;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import jakarta.persistence.TypedQuery;
import java.sql.Date;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.jdbc.core.RowMapper;

class PlayerStatsRepositoryTest {
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final EntityManager entityManager = mock(EntityManager.class);
    final PlayerStatsRepository repository = new PlayerStatsRepository(jdbc, entityManager);
    final PlayerStatsFilter filter = PlayerStatsFilter.of(2026, StatsMatchKind.ALL, StatsRecordScope.ALL,
            true, LocalDate.of(2026, 10, 15));

    @Test @SuppressWarnings("unchecked")
    void usesOriginalEntityTimeMappingInOneTeamScopedQueryAndPreservesNullAndPageOrder() throws Exception {
        var first = mock(ResultSet.class);
        var second = mock(ResultSet.class);
        when(first.getLong("id")).thenReturn(21L);
        when(second.getLong("id")).thenReturn(20L);
        when(first.getDate("played_on")).thenReturn(Date.valueOf("2026-10-15"));
        when(second.getDate("played_on")).thenReturn(Date.valueOf("2026-10-15"));
        when(first.getString("match_format")).thenReturn("TWO_HALVES_30");
        when(second.getString("match_format")).thenReturn("FOUR_QUARTERS");
        // Simulate the observed JDBC TIME/ORM LocalTime mismatch, independently of the test machine zone.
        when(first.getObject("kickoff", LocalTime.class)).thenReturn(LocalTime.of(2, 0));
        when(jdbc.query(any(PreparedStatementCreator.class), any(RowMapper.class))).thenAnswer(call -> {
            RowMapper<PlayerMatchStatsResponse.Item> mapper = call.getArgument(1);
            return List.of(mapper.mapRow(first, 0), mapper.mapRow(second, 1));
        });
        var mappedFirst = mock(Tuple.class);
        var mappedSecond = mock(Tuple.class);
        when(mappedFirst.get("id", Long.class)).thenReturn(21L);
        when(mappedFirst.get("kickoff", LocalTime.class)).thenReturn(LocalTime.of(11, 0));
        when(mappedSecond.get("id", Long.class)).thenReturn(20L);
        when(mappedSecond.get("kickoff", LocalTime.class)).thenReturn(null);
        TypedQuery<Tuple> query = mock(TypedQuery.class, RETURNS_SELF);
        when(entityManager.createQuery(contains("m.teamId = :teamId and m.id in :ids"), eq(Tuple.class))).thenReturn(query);
        when(query.getResultList()).thenReturn(List.of(mappedSecond, mappedFirst));

        var rows = repository.contributingMatches(7, filter, 9, 10, 0);
        assertThat(rows).extracting(PlayerMatchStatsResponse.Item::matchId).containsExactly(21L, 20L);
        assertThat(rows.getFirst().kickoff()).isEqualTo(LocalTime.of(11, 0));
        assertThat(rows.get(1).kickoff()).isNull();
        assertThat(rows.getFirst().matchFormat()).isEqualTo(com.jochookon.match.MatchFormat.TWO_HALVES_30);
        assertThat(rows.get(1).matchFormat()).isEqualTo(com.jochookon.match.MatchFormat.FOUR_QUARTERS);
        verify(first, never()).getObject("kickoff", LocalTime.class);
        verify(query).setParameter("teamId", 7L);
        verify(query).setParameter("ids", List.of(21L, 20L));
        verify(query, times(1)).getResultList();
    }

    @Test @SuppressWarnings("unchecked")
    void emptyPageDoesNotRunAnUnboundedOrEmptyInQuery() {
        when(jdbc.query(any(PreparedStatementCreator.class), any(RowMapper.class))).thenReturn(List.of());
        assertThat(repository.contributingMatches(7, filter, 9, 10, 100)).isEmpty();
        verifyNoInteractions(entityManager);
    }
}
