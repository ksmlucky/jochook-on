package com.jochookon.player;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class PlayerTest {
    @Test void preferencesRequireFirstChoiceAndRejectDuplicatesWithoutPartialChange() {
        Player player = Player.register("선수", null, Position.MF, null);
        player.updatePreferences(PreferredPosition.CM, PreferredPosition.CDM, PreferredPosition.ST);
        assertThatThrownBy(() -> player.updatePreferences(null, null, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> player.updatePreferences(PreferredPosition.GK, null, PreferredPosition.CM)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> player.updatePreferences(PreferredPosition.CM, PreferredPosition.CM, null)).isInstanceOf(IllegalArgumentException.class);
        assertThat(player.getThirdChoice()).isEqualTo(PreferredPosition.ST);
        player.updatePreferences(PreferredPosition.GK, null, null);
        assertThat(player.getSecondChoice()).isNull(); assertThat(player.getThirdChoice()).isNull();
    }
    @Test
    void acceptsUnknownShirtNumberAndJoinDateWithoutInventingValues() {
        Player player = Player.register("  테스트 선수  ", null, Position.MF, null);
        assertThat(player.getName()).isEqualTo("테스트 선수");
        assertThat(player.getShirtNumber()).isNull();
        assertThat(player.getJoinedOn()).isNull();
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 0, 100})
    void rejectsOutOfRangeShirtNumbers(int shirtNumber) {
        assertThatThrownBy(() -> Player.register("선수", shirtNumber, Position.GK, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsBlankName() {
        assertThatThrownBy(() -> Player.register("   ", 7, Position.FW, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void clearsOptionalFieldsWhenDetailsAreUpdated() {
        Player player = Player.register("원래 선수", 7, Position.FW, LocalDate.of(2025, 1, 1));
        player.updateDetails("  변경 선수  ", null, Position.GK, null);
        assertThat(player.getName()).isEqualTo("변경 선수");
        assertThat(player.getShirtNumber()).isNull();
        assertThat(player.getJoinedOn()).isNull();
        assertThat(player.getPosition()).isEqualTo(Position.GK);
        assertThat(player.isActive()).isTrue();
    }

    @Test
    void invalidUpdateDoesNotPartiallyChangeTheEntity() {
        Player player = Player.register("원래 선수", 7, Position.FW, null);
        assertThatThrownBy(() -> player.updateDetails("변경 선수", 100, Position.GK, null)).isInstanceOf(IllegalArgumentException.class);
        assertThat(player.getName()).isEqualTo("원래 선수");
        assertThat(player.getShirtNumber()).isEqualTo(7);
        assertThat(player.getPosition()).isEqualTo(Position.FW);
    }

    @ParameterizedTest
    @ValueSource(ints = {999, 10000})
    void rejectsDatesOutsideMySqlDateRange(int year) {
        assertThatThrownBy(() -> Player.register("선수", null, Position.MF, LocalDate.of(year, 1, 1)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsOverlongName() {
        assertThatThrownBy(() -> Player.register("가".repeat(61), null, Position.MF, null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
