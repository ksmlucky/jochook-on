package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.jochookon.player.Player;
import com.jochookon.player.PlayerRepository;
import com.jochookon.team.TeamContext;
import java.io.*;
import java.util.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockMultipartFile;

class MatchWorkbookServiceTest {
    MatchWorkbookService service;
    @BeforeEach void setup() {
        TeamContext.set(1);
        var repository = mock(PlayerRepository.class);
        var candidates = List.of(player(1, "동명 선수", 7), player(2, "동명 선수", 1), player(3, "검증 선수", null));
        when(repository.findByTeamIdAndNameIn(eq(1L), anyCollection())).thenReturn(candidates);
        service = new MatchWorkbookService(repository);
    }
    @AfterEach void clearTeamContext() { TeamContext.clear(); }
    Player player(long id, String name, Integer shirt) {
        var p = mock(Player.class); when(p.getId()).thenReturn(id); when(p.getName()).thenReturn(name); when(p.getShirtNumber()).thenReturn(shirt); return p;
    }
    MockMultipartFile file(XSSFWorkbook book) throws IOException {
        var bytes = new ByteArrayOutputStream(); book.write(bytes);
        return new MockMultipartFile("file", "match.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes.toByteArray());
    }
    XSSFWorkbook template() throws IOException { return new XSSFWorkbook(new ByteArrayInputStream(service.template())); }
    @Test void halvesWorkbookHasOnlyTwoPeriodsAndRejectsThirdOrFourthPeriodRows() throws Exception {
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(service.template(Formation.F352, MatchFormat.TWO_HALVES_30)))) {
            var sheet = book.getSheet("쿼터기록");
            assertThat(sheet.getPhysicalNumberOfRows()).isEqualTo(45);
            assertThat(sheet.getRow(44).getCell(0).getNumericCellValue()).isEqualTo(2);
            assertThat(sheet.getDataValidations().getFirst().getValidationConstraint().getExplicitListValues()).containsExactly("1", "2");
            cell(book, 1, 3, "검증 선수"); cell(book, 1, 5, "2"); cell(book, 1, 8, "1"); cell(book, 1, 9, "1");
            var parsed = service.preview(file(book), Formation.F352, MatchFormat.TWO_HALVES_30);
            assertThat(parsed.isValid()).isTrue();
            assertThat(parsed.quarters()).extracting(MatchRequest.Quarter::number).containsExactly(1, 2);
            assertThat(parsed.quarters().getFirst().lineup().getFirst().freeKickGoals()).isEqualTo(1);
            for (int period : List.of(3, 4)) {
                cell(book, 1, 0, Integer.toString(period));
                var invalid = service.preview(file(book), Formation.F352, MatchFormat.TWO_HALVES_30);
                assertThat(invalid.isValid()).isFalse();
                assertThat(invalid.rows().getFirst().errors()).anyMatch(e -> e.contains("1~2"));
                assertThat(invalid.quarters()).isEmpty();
            }
        }
    }
    void cell(XSSFWorkbook book, int row, int column, String value) { var r = book.getSheet("쿼터기록").getRow(row); var c = r.getCell(column, Row.MissingCellPolicy.CREATE_NULL_AS_BLANK); c.setCellValue(value); }
    @Test void templateHasRequiredLabelsAllQuartersAndNoFakePlayersOrDuration() throws Exception {
        try (var book = template()) {
            assertThat(book.getSheet("쿼터기록").getPhysicalNumberOfRows()).isEqualTo(89);
            Row headers = book.getSheet("쿼터기록").getRow(0);
            assertThat(headers).extracting(Cell::getStringCellValue).containsExactly(MatchWorkbookService.HEADERS);
            assertThat(book.getSheet("쿼터기록").getRow(88).getCell(0).getNumericCellValue()).isEqualTo(4);
            assertThat(book.getSheet("작성안내")).isNotNull();
            assertThatThrownBy(() -> service.preview(file(book))).hasMessageContaining("입력한 선수가 없습니다");
        }
    }
    @Test void parsesOneToOneSubstitutionAndShirtWithBlankStats() throws Exception {
        try (var book = template()) {
            cell(book, 1, 3, "동명 선수"); cell(book, 1, 4, "7"); cell(book, 1, 5, "2");
            cell(book, 2, 3, "동명 선수"); cell(book, 2, 4, "1"); cell(book, 2, 6, "1");
            var result = service.preview(file(book));
            assertThat(result.isValid()).isTrue(); assertThat(result.rows()).hasSize(2);
            assertThat(result.quarters()).hasSize(4); assertThat(result.quarters().get(1).lineup()).isEmpty();
            assertThat(result.quarters().getFirst().lineup()).extracting(MatchRequest.Appearance::entryOrder).containsExactly(0, 1);
            assertThat(result.quarters().getFirst().lineup()).extracting(MatchRequest.Appearance::playerId).containsExactly(1L, 2L);
            assertThat(result.rows().get(1).shirtNumber()).isEqualTo(1);
        }
    }
    @Test void refusesAmbiguousNamesUntilIdDisambiguatesAndNeverCreatesPlayers() throws Exception {
        try (var book = template()) {
            cell(book, 1, 3, "동명 선수");
            assertThat(service.preview(file(book)).rows().getFirst().errors()).anyMatch(e -> e.contains("동명이인"));
            cell(book, 1, 7, "2");
            assertThat(service.preview(file(book)).rows().getFirst().playerId()).isEqualTo(2);
            cell(book, 1, 3, "등록 안 된 선수");
            assertThat(service.preview(file(book)).isValid()).isFalse();
        }
    }
    @Test void rejectsOrphanSubDuplicatePlayersAndDuplicatePositions() throws Exception {
        try (var book = template()) {
            cell(book, 2, 3, "검증 선수");
            assertThat(service.preview(file(book)).rows().getFirst().errors()).anyMatch(e -> e.contains("선발"));
            cell(book, 1, 3, "검증 선수");
            assertThat(service.preview(file(book)).rows()).allMatch(r -> r.errors().stream().anyMatch(e -> e.contains("같은 선수")));
            cell(book, 2, 3, "동명 선수"); cell(book, 2, 4, "7"); cell(book, 2, 2, "선발");
            assertThat(service.preview(file(book)).rows()).allMatch(r -> r.errors().stream().anyMatch(e -> e.contains("출전 구분이 중복")));
        }
    }
    @Test void rejectsFormulasBadStatsAndExcessAssists() throws Exception {
        try (var book = template()) {
            cell(book, 1, 3, "검증 선수"); cell(book, 1, 5, "1.5");
            assertThat(service.preview(file(book)).rows().getFirst().errors()).anyMatch(e -> e.contains("정수"));
            cell(book, 1, 5, "0"); cell(book, 1, 6, "1");
            assertThat(service.preview(file(book)).rows().getFirst().errors()).anyMatch(e -> e.contains("도움 합계"));
            book.getSheet("쿼터기록").getRow(1).getCell(5).setCellFormula("1+1");
            assertThat(service.preview(file(book)).rows().getFirst().errors()).anyMatch(e -> e.contains("수식"));
        }
    }
    @Test void rejectsChangedHeadersExtraDataAndFakeFiles() throws Exception {
        try (var book = template()) {
            cell(book, 0, 0, "다른 제목");
            assertThatThrownBy(() -> service.preview(file(book))).isInstanceOf(IllegalArgumentException.class);
        }
        try (var book = template()) {
            cell(book, 1, 10, "추가 데이터");
            assertThatThrownBy(() -> service.preview(file(book))).hasMessageContaining("10개 열 밖");
        }
        assertThatThrownBy(() -> service.preview(new MockMultipartFile("file", "bad.xlsx", "", new byte[2 * 1024 * 1024 + 1]))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.preview(new MockMultipartFile("file", "bad.xlsx", "", "not-xlsx".getBytes()))).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void newTenColumnsParseGoalTypesAndRejectSubsetsAboveTotal() throws Exception {
        try (var book = template()) {
            cell(book, 1, 3, "검증 선수"); cell(book, 1, 5, "3"); cell(book, 1, 8, "1"); cell(book, 1, 9, "2");
            var result = service.preview(file(book));
            assertThat(result.isValid()).isTrue();
            var a = result.quarters().getFirst().lineup().getFirst();
            assertThat(a.goals()).isEqualTo(3); assertThat(a.freeKickGoals()).isEqualTo(1); assertThat(a.penaltyGoals()).isEqualTo(2);
            cell(book, 1, 9, "3");
            assertThat(service.preview(file(book)).rows().getFirst().errors()).anyMatch(e -> e.contains("총득점"));
            cell(book, 1, 9, "-1");
            assertThat(service.preview(file(book)).rows().getFirst().errors()).anyMatch(e -> e.contains("정수"));
        }
    }
    @Test void oldEightColumnsKeepGoalTypesOmittedButNewBlankColumnsAreExplicitZero() throws Exception {
        try (var book = template()) {
            cell(book, 1, 3, "검증 선수");
            var modern = service.preview(file(book)).quarters().getFirst().lineup().getFirst();
            assertThat(modern.freeKickGoals()).isZero(); assertThat(modern.penaltyGoals()).isZero();
            var headers = book.getSheet("쿼터기록").getRow(0);
            headers.removeCell(headers.getCell(8)); headers.removeCell(headers.getCell(9));
            var legacy = service.preview(file(book)).quarters().getFirst().lineup().getFirst();
            assertThat(legacy.freeKickGoals()).isNull(); assertThat(legacy.penaltyGoals()).isNull();
            cell(book, 1, 8, "1");
            assertThatThrownBy(() -> service.preview(file(book))).hasMessageContaining("8개 열 밖");
        }
    }
    @Test void goalTypeOnlyRowsAreValidatedInsteadOfSilentlyTreatedAsEmpty() throws Exception {
        try (var book = template()) {
            cell(book, 1, 8, "1");
            assertThat(service.preview(file(book)).rows()).singleElement().satisfies(r -> assertThat(r.errors()).anyMatch(e -> e.contains("이름")));
        }
    }
    @Test void templatesUseExactlySelectedFormationAndRejectOtherFormationSlots() throws Exception {
        for (var formation : Formation.values()) {
            try (var book = new XSSFWorkbook(new ByteArrayInputStream(service.template(formation)))) {
                var sheet = book.getSheet("쿼터기록");
                assertThat(sheet.getPhysicalNumberOfRows()).isEqualTo(89);
                var slots = new ArrayList<String>();
                for (int row = 1; row <= 22; row += 2) slots.add(sheet.getRow(row).getCell(1).getStringCellValue());
                assertThat(slots).containsExactlyElementsOf(formation.slots().stream().map(Enum::name).toList());
                cell(book, 1, 3, "검증 선수");
                assertThat(service.preview(file(book), formation).isValid()).isTrue();
                var invalid = Arrays.stream(LineupSlot.values()).filter(s -> !formation.slots().contains(s)).findFirst().orElseThrow();
                cell(book, 1, 1, invalid.name());
                assertThat(service.preview(file(book), formation).rows().getFirst().errors()).anyMatch(e -> e.contains("포메이션에 없는 자리"));
            }
        }
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(service.template(Formation.F4231)))) {
            cell(book, 11, 3, "검증 선수"); // LCDM (four-character slot)
            assertThat(service.preview(file(book), Formation.F4231).quarters().getFirst().lineup().getFirst().slot()).isEqualTo(LineupSlot.LCDM);
        }
    }
    @Test void threeBackWorkbookParsesCentralDefenderAndFormationSpecificWidePlayers() throws Exception {
        for (var formation : List.of(Formation.F352, Formation.F343)) {
            try (var book = new XSSFWorkbook(new ByteArrayInputStream(service.template(formation)))) {
                cell(book, 5, 3, "동명 선수"); cell(book, 5, 4, "7"); cell(book, 5, 5, "1");
                cell(book, 9, 3, "동명 선수"); cell(book, 9, 4, "1"); cell(book, 9, 6, "1");
                cell(book, 11, 3, "검증 선수");
                var preview = service.preview(file(book), formation);
                assertThat(preview.isValid()).isTrue();
                assertThat(preview.quarters().getFirst().lineup()).extracting(MatchRequest.Appearance::slot)
                        .containsExactly(LineupSlot.CCB, formation == Formation.F352 ? LineupSlot.LWB : LineupSlot.LM,
                                formation == Formation.F352 ? LineupSlot.RWB : LineupSlot.RM);
                assertThat(preview.quarters().getFirst().lineup()).extracting(MatchRequest.Appearance::goals).containsExactly(1, 0, 0);
            }
        }
    }
}
