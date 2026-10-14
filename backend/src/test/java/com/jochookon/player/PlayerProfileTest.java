package com.jochookon.player;

import static org.assertj.core.api.Assertions.*;
import org.junit.jupiter.api.Test;

class PlayerProfileTest {
    @Test void profileCanBeRecordedCorrectedAndCleared() {
        var player = Player.register("프로필 선수", null, Position.MF, null);
        player.updateProfile(1996, " 코치 ");
        assertThat(player.getBirthYear()).isEqualTo(1996);
        assertThat(player.getClubRole()).isEqualTo("코치");
        player.updateProfile(null, " ");
        assertThat(player.getBirthYear()).isNull(); assertThat(player.getClubRole()).isEqualTo("정회원");
    }
    @Test void onlyFiveClubRolesAreAllowedAndMissingRoleDefaultsToMember() {
        var player = Player.register("직책 검증 선수", null, Position.GK, null);
        assertThat(player.getClubRole()).isEqualTo("정회원");
        for (String role : java.util.List.of("정회원", "코치", "감독", "총무", "회장")) {
            player.updateProfile(null, role);
            assertThat(player.getClubRole()).isEqualTo(role);
        }
        assertThatThrownBy(() -> player.updateProfile(null, "골키퍼")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> player.updateProfile(null, "ADMIN")).isInstanceOf(IllegalArgumentException.class);
        player.updateProfile(null, null);
        assertThat(player.getClubRole()).isEqualTo("정회원");
    }
    @Test void rejectsFutureYearsAndOutOfRangeProfiles() {
        var player = Player.register("프로필 선수", null, Position.UN, null);
        int current = java.time.Year.now(java.time.ZoneId.of("Asia/Seoul")).getValue();
        assertThatThrownBy(() -> player.updateProfile(current + 1, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> player.updateProfile(1899, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> player.updateProfile(null, "직".repeat(31))).isInstanceOf(IllegalArgumentException.class);
        player.updateProfile(current, null); assertThat(player.getBirthYear()).isEqualTo(current);
    }
    @Test void unknownPositionDoesNotInventPreferences() {
        var player = Player.register("미확인 선수", null, Position.UN, null);
        player.updatePreferences(null, null, null);
        assertThat(player.getFirstChoice()).isNull();
        assertThatThrownBy(() -> player.updatePreferences(PreferredPosition.CM, null, null)).isInstanceOf(IllegalArgumentException.class);
        player.updateDetails("미확인 선수", null, Position.MF, null);
        assertThatThrownBy(() -> player.updatePreferences(null, null, null)).isInstanceOf(IllegalArgumentException.class);
        player.updatePreferences(PreferredPosition.CM, null, null);
    }
}
