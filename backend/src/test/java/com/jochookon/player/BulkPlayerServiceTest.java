package com.jochookon.player;

import com.jochookon.team.TeamContext;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import java.util.*;
import org.junit.jupiter.api.*;

class BulkPlayerServiceTest {
    static ValidatorFactory validation;
    PlayerRepository players;
    BulkPlayerService service;
    @BeforeAll static void openValidation() { validation = Validation.buildDefaultValidatorFactory(); }
    @AfterAll static void closeValidation() { validation.close(); }
    @BeforeEach void setup() {
        TeamContext.set(1);
        players = mock(PlayerRepository.class);
        service = new BulkPlayerService(players, validation.getValidator());
    }
    @AfterEach void clearTeamContext() { TeamContext.clear(); }
    static BulkPlayerRow row(String name, String first, String second, String third) {
        return new BulkPlayerRow(name, "MF", "", "", first, second, third, "", "");
    }
    @Test void acceptsOneChoiceAndUnknownOptionalValues() {
        var result = service.preview(List.of(row("선수", "CM", "", "")), null);
        assertThat(result.isValid()).isTrue(); verify(players, never()).saveAllAndFlush(any());
    }
    @Test void rejectsDuplicateChoicesAndGaps() {
        var result = service.preview(List.of(row("선수1", "CM", "CM", ""), row("선수2", "CM", "", "ST")), null);
        assertThat(result.isValid()).isFalse(); assertThat(result.rows()).allMatch(r -> !r.errors().isEmpty());
    }
    @Test void requiresFirstChoiceAndRejectsUnsupportedCodes() {
        var result = service.preview(List.of(row("선수1", "", "", ""), row("선수2", "CF", "", "")), null);
        assertThat(result.isValid()).isFalse(); assertThat(result.rows()).allMatch(r -> !r.errors().isEmpty());
    }
    @Test void validatesEveryRowBeforeSavingAnything() {
        assertThatThrownBy(() -> service.create(List.of(row("정상 선수", "CM", "CDM", "ST"), row("", "ST", "", ""))))
                .isInstanceOf(BulkValidationException.class);
        verify(players, never()).saveAllAndFlush(any());
    }
    @Test void warnsOnRepeatedAndExistingNamesWithoutRejectingNamesakes() {
        when(players.findByTeamIdAndNameIn(eq(1L), any())).thenReturn(List.of(Player.register("동명 선수", null, Position.MF, null).assignToTeam(1)));
        var result = service.preview(List.of(row("동명 선수", "CM", "", ""), row("동명 선수", "ST", "", "")), null);
        assertThat(result.isValid()).isTrue(); assertThat(result.rows().getFirst().warnings()).hasSize(2);
    }
    @Test void rejectsOverLimitAndEmptyInput() {
        assertThatThrownBy(() -> service.preview(List.of(), null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.preview(Collections.nCopies(201, row("선수", "CM", "", "")), null)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void rejectsFractionalShirtsAndImpossibleDates() {
        var result = service.preview(List.of(new BulkPlayerRow("선수", "MF", "1.5", "", "CM", "", "", "", ""),
                new BulkPlayerRow("선수", "MF", "", "2026-02-30", "CM", "", "", "", "")), null);
        assertThat(result.rows()).allMatch(r -> !r.errors().isEmpty());
    }
    @Test void normalizesCodesAndKeepsSpreadsheetLineNumbers() {
        var result = service.preview(List.of(row(" 선수 ", " cm ", "cdm", "")), List.of(8));
        assertThat(result.rows().getFirst().rowNumber()).isEqualTo(8);
        assertThat(result.rows().getFirst().values().firstChoice()).isEqualTo("CM");
    }
    @Test void acceptsUnknownPositionAndProfileButRejectsFutureOrShortYear() {
        var good = service.preview(List.of(new BulkPlayerRow("미확인 선수", "UN", "", "", "", "", "", "1996", " 코치 ")), null);
        assertThat(good.isValid()).isTrue();
        assertThat(good.rows().getFirst().values().clubRole()).isEqualTo("코치");
        for (String year : List.of("96", "1996.5", "9999", "1899")) {
            assertThat(service.preview(List.of(new BulkPlayerRow("선수", "MF", "", "", "CM", "", "", year, "")), null).isValid()).isFalse();
        }
        assertThat(service.preview(List.of(new BulkPlayerRow("선수", "UN", "", "", "CM", "", "", "", "")), null).isValid()).isFalse();
    }
    @Test void rejectsDuplicateNumbersAcrossInputAndExistingActivePlayers() {
        when(players.findByTeamIdAndActiveTrueAndShirtNumberIn(eq(1L), any())).thenReturn(List.of(Player.register("기존 선수", 7, Position.UN, null).assignToTeam(1)));
        var rows = List.of(new BulkPlayerRow("첫 선수", "UN", "07", "", "", "", "", "", ""),
                new BulkPlayerRow("다음 선수", "UN", "7", "", "", "", "", "", ""));
        var preview = service.preview(rows, List.of(3, 8));
        assertThat(preview.isValid()).isFalse();
        assertThat(preview.rows()).allSatisfy(row -> assertThat(row.errors()).hasSize(2));
        assertThat(preview.rows().getLast().rowNumber()).isEqualTo(8);
        assertThatThrownBy(() -> service.create(rows)).isInstanceOf(BulkValidationException.class);
        verify(players, never()).saveAllAndFlush(any());
    }
    @Test void allowsSeveralPlayersWithoutNumbersButRejectsZero() {
        assertThat(service.preview(List.of(row("첫 선수", "CM", "", ""), row("둘째 선수", "ST", "", "")), null).isValid()).isTrue();
        var zero = new BulkPlayerRow("영번 선수", "UN", "0", "", "", "", "", "", "");
        assertThat(service.preview(List.of(zero), null).isValid()).isFalse();
    }
}
