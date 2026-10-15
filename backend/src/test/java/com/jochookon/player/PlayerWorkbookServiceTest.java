package com.jochookon.player;

import com.jochookon.team.TeamContext;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import java.io.*;
import java.time.LocalDateTime;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockMultipartFile;

class PlayerWorkbookServiceTest {
    static ValidatorFactory validation;
    PlayerWorkbookService service;
    @BeforeAll static void openValidation() { validation = Validation.buildDefaultValidatorFactory(); }
    @AfterAll static void closeValidation() { validation.close(); }
    @BeforeEach void setup() { TeamContext.set(1); service = new PlayerWorkbookService(new BulkPlayerService(mock(PlayerRepository.class), validation.getValidator())); }
    @AfterEach void clearTeamContext() { TeamContext.clear(); }
    MockMultipartFile file(XSSFWorkbook workbook) throws IOException {
        var bytes = new ByteArrayOutputStream(); workbook.write(bytes);
        return new MockMultipartFile("file", "players.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes.toByteArray());
    }
    @Test void templateContainsNineHeadersAndNoFakePlayers() throws Exception {
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(service.template()))) {
            Sheet sheet = workbook.getSheetAt(0);
            assertThat(sheet.getPhysicalNumberOfRows()).isEqualTo(1);
            assertThat(sheet.getRow(0).getLastCellNum()).isEqualTo((short) 9);
            assertThat(sheet.getRow(0)).extracting(Cell::getStringCellValue).containsExactly(
                    "이름 (필수)", "기본 포지션 (필수)", "등번호 (선택)", "가입일 (선택)",
                    "1지망 (필수: UN 제외)", "2지망 (선택)", "3지망 (선택)", "생년 (선택)", "직책 (선택)");
            assertThat(sheet.getDataValidations()).hasSize(5);
            assertThat(sheet.getDataValidations().get(4).getValidationConstraint().getExplicitListValues())
                    .containsExactly("정회원", "코치", "감독", "총무", "회장");
        }
    }
    @Test void acceptsLegacyHeadersWithoutRequiredLabels() throws Exception {
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(service.template()))) {
            Sheet sheet = workbook.getSheetAt(0);
            String[] legacyHeaders = {"이름", "기본 포지션", "등번호", "가입일", "1지망", "2지망", "3지망"};
            sheet.getRow(0).removeCell(sheet.getRow(0).getCell(8));
            sheet.getRow(0).removeCell(sheet.getRow(0).getCell(7));
            for (int i = 0; i < legacyHeaders.length; i++) {
                sheet.getRow(0).getCell(i).setCellValue(legacyHeaders[i]);
            }
            Row row = sheet.createRow(1);
            row.createCell(0).setCellValue("양식 검증 선수");
            row.createCell(1).setCellValue("MF");
            row.createCell(4).setCellValue("CM");
            var result = service.preview(file(workbook));
            assertThat(result.isValid()).isTrue();
            assertThat(result.rows()).hasSize(1);
            assertThat(result.rows().getFirst().values().firstChoice()).isEqualTo("CM");
        }
    }
    @Test void parsesNumericShirtsExcelDatesAndBlankLines() throws Exception {
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(service.template()))) {
            Row row = workbook.getSheetAt(0).createRow(3);
            row.createCell(0).setCellValue("엑셀 선수"); row.createCell(1).setCellValue("MF"); row.createCell(2).setCellValue(1);
            Cell date = row.createCell(3); date.setCellValue(LocalDateTime.of(2026, 10, 13, 0, 0));
            var style = workbook.createCellStyle(); style.setDataFormat(workbook.createDataFormat().getFormat("yyyy-mm-dd")); date.setCellStyle(style);
            row.createCell(4).setCellValue("CM"); row.createCell(5).setCellValue("CDM");
            var result = service.preview(file(workbook));
            assertThat(result.isValid()).isTrue(); assertThat(result.rows().getFirst().rowNumber()).isEqualTo(4);
            assertThat(result.rows().getFirst().values().joinedOn()).isEqualTo("2026-10-13");
            assertThat(result.rows().getFirst().values().shirtNumber()).isEqualTo("1");
        }
    }
    @Test void rejectsFormulaWithoutEvaluatingIt() throws Exception {
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(service.template()))) {
            Row row = workbook.getSheetAt(0).createRow(1);
            row.createCell(0).setCellFormula("1+1"); row.createCell(1).setCellValue("MF"); row.createCell(4).setCellValue("CM");
            var result = service.preview(file(workbook));
            assertThat(result.isValid()).isFalse(); assertThat(result.rows().getFirst().errors()).anyMatch(s -> s.contains("수식"));
        }
    }
    @Test void rejectsChangedHeadersAndExtraSheets() throws Exception {
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(service.template()))) {
            workbook.getSheetAt(0).getRow(0).getCell(0).setCellValue("다른 제목");
            assertThatThrownBy(() -> service.preview(file(workbook))).isInstanceOf(IllegalArgumentException.class);
        }
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(service.template()))) {
            workbook.createSheet("다른 시트");
            assertThatThrownBy(() -> service.preview(file(workbook))).isInstanceOf(IllegalArgumentException.class);
        }
    }
    @Test void rejectsOversizedAndFakeWorkbooks() {
        assertThatThrownBy(() -> service.preview(new MockMultipartFile("file", "bad.xlsx", "", new byte[2 * 1024 * 1024 + 1]))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.preview(new MockMultipartFile("file", "bad.xlsx", "", "not a workbook".getBytes()))).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void importsBirthYearAndClubRoleWithUnknownPosition() throws Exception {
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(service.template()))) {
            Row row = workbook.getSheetAt(0).createRow(1);
            row.createCell(0).setCellValue("프로필 검증 선수"); row.createCell(1).setCellValue("UN");
            row.createCell(7).setCellValue(1996); row.createCell(8).setCellValue("코치");
            var result = service.preview(file(workbook));
            assertThat(result.isValid()).isTrue();
            assertThat(result.rows().getFirst().values().birthYear()).isEqualTo("1996");
            assertThat(result.rows().getFirst().values().clubRole()).isEqualTo("코치");
        }
    }
    @Test void acceptsExpandedMidfieldPreferencesAndListsThemInTemplate() throws Exception {
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(service.template()))) {
            Sheet sheet = workbook.getSheetAt(0);
            assertThat(sheet.getDataValidations().get(1).getValidationConstraint().getExplicitListValues())
                    .contains("LM", "RM", "CAM");
            Row row = sheet.createRow(1);
            row.createCell(0).setCellValue("미드필더 검증"); row.createCell(1).setCellValue("MF");
            row.createCell(4).setCellValue("LM"); row.createCell(5).setCellValue("RM"); row.createCell(6).setCellValue("CAM");
            var result = service.preview(file(workbook));
            assertThat(result.isValid()).isTrue();
            assertThat(result.rows().getFirst().values().thirdChoice()).isEqualTo("CAM");
        }
    }
    @Test void acceptsWingbackPreferencesAndIncludesThemInExcelChoices() throws Exception {
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(service.template()))) {
            Sheet sheet = workbook.getSheetAt(0);
            assertThat(sheet.getDataValidations().get(1).getValidationConstraint().getExplicitListValues()).contains("LWB", "RWB");
            Row row = sheet.createRow(1);
            row.createCell(0).setCellValue("윙백 검증"); row.createCell(1).setCellValue("DF");
            row.createCell(4).setCellValue("LWB"); row.createCell(5).setCellValue("RWB"); row.createCell(6).setCellValue("LB");
            var result = service.preview(file(workbook));
            assertThat(result.isValid()).isTrue();
            assertThat(result.rows().getFirst().values().firstChoice()).isEqualTo("LWB");
            assertThat(result.rows().getFirst().values().secondChoice()).isEqualTo("RWB");
        }
    }
}
