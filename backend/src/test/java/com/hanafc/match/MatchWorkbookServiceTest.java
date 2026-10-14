package com.hanafc.match;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.hanafc.player.Player;
import com.hanafc.player.PlayerRepository;
import java.io.*;
import java.util.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockMultipartFile;

class MatchWorkbookServiceTest {
    MatchWorkbookService service;
    @BeforeEach void setup() {
        var repository = mock(PlayerRepository.class);
        var candidates = List.of(player(1, "동명 선수", 7), player(2, "동명 선수", 1), player(3, "검증 선수", null));
        when(repository.findByNameIn(anyCollection())).thenReturn(candidates);
        service = new MatchWorkbookService(repository);
    }
    Player player(long id, String name, Integer shirt) {
        var p = mock(Player.class); when(p.getId()).thenReturn(id); when(p.getName()).thenReturn(name); when(p.getShirtNumber()).thenReturn(shirt); return p;
    }
    MockMultipartFile file(XSSFWorkbook book) throws IOException {
        var bytes = new ByteArrayOutputStream(); book.write(bytes);
        return new MockMultipartFile("file", "match.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes.toByteArray());
    }
    XSSFWorkbook template() throws IOException { return new XSSFWorkbook(new ByteArrayInputStream(service.template())); }
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
            cell(book, 1, 8, "추가 데이터");
            assertThatThrownBy(() -> service.preview(file(book))).hasMessageContaining("8개 열 밖");
        }
        assertThatThrownBy(() -> service.preview(new MockMultipartFile("file", "bad.xlsx", "", new byte[2 * 1024 * 1024 + 1]))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.preview(new MockMultipartFile("file", "bad.xlsx", "", "not-xlsx".getBytes()))).isInstanceOf(IllegalArgumentException.class);
    }
}
