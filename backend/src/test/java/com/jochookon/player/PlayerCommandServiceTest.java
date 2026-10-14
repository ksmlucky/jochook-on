package com.jochookon.player;

import com.jochookon.team.TeamContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.util.ReflectionTestUtils;

class PlayerCommandServiceTest {
    private final PlayerRepository players = mock(PlayerRepository.class);
    private final PlayerCommandService service = new PlayerCommandService(players);
    private Player existing;

    @BeforeEach
    void prepareExistingPlayer() {
        TeamContext.set(1);
        existing = Player.register("기존 선수", 7, Position.FW, LocalDate.of(2025, 1, 1)).assignToTeam(1);
        ReflectionTestUtils.setField(existing, "id", 5L);
        ReflectionTestUtils.setField(existing, "version", 2L);
    }

    @AfterEach void clearTeamContext() { TeamContext.clear(); }

    @Test
    void creationReturnsPersistedIdAndVersion() {
        when(players.saveAndFlush(any(Player.class))).thenAnswer(invocation -> {
            Player saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 6L);
            ReflectionTestUtils.setField(saved, "version", 0L);
            return saved;
        });
        PlayerResponse result = service.create(new CreatePlayerRequest("새 선수", null, Position.MF, null, PreferredPosition.CM, null, null, null, null));
        assertThat(result.id()).isEqualTo(6);
        assertThat(result.version()).isZero();
        assertThat(result.shirtNumber()).isNull();
    }

    @Test
    void staleVersionDoesNotMutateOrFlushPlayer() {
        when(players.findByIdAndTeamId(5L, 1L)).thenReturn(Optional.of(existing));
        assertThatThrownBy(() -> service.update(5, new UpdatePlayerRequest("바꿀 이름", null, Position.MF, null, 1L, PreferredPosition.CM, null, null, null, null)))
                .isInstanceOf(ObjectOptimisticLockingFailureException.class);
        assertThat(existing.getName()).isEqualTo("기존 선수");
        verify(players, never()).flush();
    }

    @Test
    void updatesOnlyExistingActivePlayerAndFlushesBeforeReturning() {
        when(players.findByIdAndTeamId(5L, 1L)).thenReturn(Optional.of(existing));
        doAnswer(invocation -> { ReflectionTestUtils.setField(existing, "version", 3L); return null; }).when(players).flush();
        PlayerResponse result = service.update(5, new UpdatePlayerRequest("변경 선수", null, Position.GK, null, 2L, PreferredPosition.CM, null, null, null, null));
        assertThat(result.name()).isEqualTo("변경 선수");
        assertThat(result.shirtNumber()).isNull();
        assertThat(result.joinedOn()).isNull();
        assertThat(result.version()).isEqualTo(3);
    }

    @Test
    void missingPlayerReturnsNotFound() {
        assertThatThrownBy(() -> service.update(5, new UpdatePlayerRequest("변경 선수", null, Position.GK, null, 2L, PreferredPosition.CM, null, null, null, null)))
                .isInstanceOf(PlayerNotFoundException.class);
        verify(players, never()).flush();
    }

    @Test
    void inactivePlayerCannotBeEdited() {
        ReflectionTestUtils.setField(existing, "active", false);
        when(players.findByIdAndTeamId(5L, 1L)).thenReturn(Optional.of(existing));
        assertThatThrownBy(() -> service.update(5, new UpdatePlayerRequest("변경 선수", null, Position.GK, null, 2L, PreferredPosition.CM, null, null, null, null)))
                .isInstanceOf(PlayerNotFoundException.class);
        verify(players, never()).flush();
    }

    @Test void duplicateShirtIsRejectedBeforeCreatingOrChangingThePlayer() {
        when(players.existsByTeamIdAndActiveTrueAndShirtNumber(1L, 7)).thenReturn(true);
        assertThatThrownBy(() -> service.create(new CreatePlayerRequest("신규 선수", 7, Position.UN, null, null, null, null, null, null)))
                .isInstanceOf(DuplicateShirtNumberException.class);
        verify(players, never()).saveAndFlush(any());
        when(players.findByIdAndTeamId(5L, 1L)).thenReturn(Optional.of(existing));
        when(players.existsByTeamIdAndActiveTrueAndShirtNumberAndIdNot(1L, 9, 5L)).thenReturn(true);
        assertThatThrownBy(() -> service.update(5, new UpdatePlayerRequest("변경 선수", 9, Position.UN, null, 2L, null, null, null, null, null)))
                .isInstanceOf(DuplicateShirtNumberException.class);
        assertThat(existing.getName()).isEqualTo("기존 선수");
        assertThat(existing.getShirtNumber()).isEqualTo(7);
        verify(players, never()).flush();
    }
}
