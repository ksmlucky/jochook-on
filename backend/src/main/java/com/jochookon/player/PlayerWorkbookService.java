package com.jochookon.player;

import java.io.*;
import java.math.BigDecimal;
import java.util.*;
import java.util.zip.ZipInputStream;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PlayerWorkbookService {
    static final String[] HEADERS = {"이름", "기본 포지션", "등번호", "가입일", "1지망", "2지망", "3지망", "생년", "직책"};
    private final BulkPlayerService bulk;
    public PlayerWorkbookService(BulkPlayerService bulk) { this.bulk = bulk; }

    public PlayerImportPreview preview(MultipartFile file) {
        if (file.isEmpty() || file.getSize() > 2 * 1024 * 1024 || file.getOriginalFilename() == null
                || !file.getOriginalFilename().toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
            throw new IllegalArgumentException("2MB 이하의 .xlsx 파일을 선택해 주세요. .xls는 .xlsx로 저장해 주세요.");
        }
        try {
            byte[] bytes = file.getBytes();
            checkArchive(bytes);
            try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
                if (workbook.getNumberOfSheets() != 1) throw new IllegalArgumentException("선수명단 시트 한 개만 포함한 양식을 사용해 주세요.");
                Sheet sheet = workbook.getSheetAt(0);
                Row header = sheet.getRow(0);
                int columns = header != null && header.getLastCellNum() <= 7 ? 7 : HEADERS.length;
                for (int c = 0; c < columns; c++) {
                    String label = header == null ? "" : value(header.getCell(c), c);
                    // 필수/선택 표시가 없던 기존 양식도 계속 사용할 수 있다.
                    if (!HEADERS[c].equals(label) && !templateHeader(c).equals(label) && !(c == 4 && label.equals("1지망 (필수)"))) {
                        throw new IllegalArgumentException("첫 행의 열 이름과 순서를 양식과 동일하게 유지해 주세요.");
                    }
                }
                List<BulkPlayerRow> rows = new ArrayList<>();
                List<Integer> numbers = new ArrayList<>();
                Set<Integer> formulas = new HashSet<>();
                for (Row row : sheet) {
                    if (row.getRowNum() == 0) continue;
                    boolean populated = false;
                    boolean formula = false;
                    for (Cell cell : row) {
                        if (cell.getCellType() == CellType.FORMULA) formula = true;
                        if (!value(cell, cell.getColumnIndex()).isBlank()) {
                            populated = true;
                            if (cell.getColumnIndex() >= columns) throw new IllegalArgumentException("양식의 " + columns + "개 열 밖에 입력된 값이 있습니다. 확인 후 다시 올려 주세요.");
                        }
                    }
                    if (!populated) continue;
                    if (rows.size() == BulkPlayerService.MAX_ROWS) throw new IllegalArgumentException("엑셀은 한 번에 200명까지 올릴 수 있습니다.");
                    rows.add(new BulkPlayerRow(value(row.getCell(0), 0), value(row.getCell(1), 1), value(row.getCell(2), 2),
                            value(row.getCell(3), 3), value(row.getCell(4), 4), value(row.getCell(5), 5), value(row.getCell(6), 6),
                            columns == 7 ? "" : value(row.getCell(7), 7), columns == 7 ? "" : value(row.getCell(8), 8)));
                    numbers.add(row.getRowNum() + 1);
                    if (formula) formulas.add(row.getRowNum() + 1);
                }
                PlayerImportPreview result = bulk.preview(rows, numbers);
                return new PlayerImportPreview(result.rows().stream().map(row -> {
                    if (!formulas.contains(row.rowNumber())) return row;
                    List<String> errors = new ArrayList<>(row.errors());
                    errors.add("수식은 사용할 수 없습니다. 엑셀에서 값으로 붙여넣어 주세요.");
                    return new PlayerImportPreview.Row(row.rowNumber(), row.values(), errors, row.warnings());
                }).toList());
            }
        } catch (IllegalArgumentException exception) { throw exception; }
        catch (Exception exception) { throw new IllegalArgumentException("엑셀을 읽지 못했습니다. 암호가 없는 정상 .xlsx 양식인지 확인해 주세요."); }
    }

    private String value(Cell cell, int column) {
        if (cell == null || cell.getCellType() == CellType.BLANK) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().strip();
            case NUMERIC -> column == 3 && DateUtil.isCellDateFormatted(cell)
                    ? cell.getLocalDateTimeCellValue().toLocalDate().toString()
                    : BigDecimal.valueOf(cell.getNumericCellValue()).stripTrailingZeros().toPlainString();
            case FORMULA -> "=" + cell.getCellFormula();
            default -> new DataFormatter(Locale.ROOT).formatCellValue(cell);
        };
    }

    private void checkArchive(byte[] bytes) throws IOException {
        // 압축 해제 크기도 제한한다. 수식/매크로 실행이나 외부 링크 갱신은 하지 않는다.
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            long expanded = 0;
            int entries = 0;
            byte[] buffer = new byte[8192];
            for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                if (++entries > 300 || entry.getName().toLowerCase(Locale.ROOT).contains("vbaproject")) {
                    throw new IllegalArgumentException("매크로 또는 지나치게 복잡한 엑셀은 지원하지 않습니다.");
                }
                for (int read; (read = zip.read(buffer)) != -1;) {
                    expanded += read;
                    if (expanded > 20 * 1024 * 1024) throw new IllegalArgumentException("엑셀 내부 데이터가 너무 큽니다. 선수명단만 새 양식에 복사해 주세요.");
                }
            }
        }
    }

    private String templateHeader(int column) {
        if (column == 4) return "1지망 (필수: UN 제외)";
        boolean required = column == 0 || column == 1;
        return HEADERS[column] + (required ? " (필수)" : " (선택)");
    }

    public byte[] template() {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("선수명단");
            sheet.createFreezePane(0, 1);
            Font font = workbook.createFont(); font.setBold(true); font.setColor(IndexedColors.WHITE.getIndex());
            CellStyle headerStyle = workbook.createCellStyle(); headerStyle.setFont(font);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex()); headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            CellStyle text = workbook.createCellStyle(); text.setDataFormat(workbook.createDataFormat().getFormat("@"));
            CellStyle date = workbook.createCellStyle(); date.setDataFormat(workbook.createDataFormat().getFormat("yyyy-mm-dd"));
            Row header = sheet.createRow(0); header.setHeightInPoints(26);
            for (int i = 0; i < HEADERS.length; i++) {
                Cell cell = header.createCell(i); cell.setCellValue(templateHeader(i)); cell.setCellStyle(headerStyle);
                sheet.setColumnWidth(i, (i <= 1 || i == 4 ? 28 : 18) * 256);
                sheet.setDefaultColumnStyle(i, i == 3 ? date : text);
            }
            var helper = sheet.getDataValidationHelper();
            for (int column : new int[]{1, 4, 5, 6, 8}) {
                String[] options = column == 8 ? ClubRoles.VALUES.toArray(String[]::new)
                        : column == 1 ? Arrays.stream(Position.values()).map(Enum::name).toArray(String[]::new) : Arrays.stream(PreferredPosition.values()).map(Enum::name).toArray(String[]::new);
                var validation = helper.createValidation(helper.createExplicitListConstraint(options), new CellRangeAddressList(1, 200, column, column));
                validation.setShowErrorBox(true); validation.setEmptyCellAllowed(column >= 4);
                validation.createErrorBox("입력값 확인", "목록의 값을 선택해 주세요.");
                if (column == 8) { validation.setShowPromptBox(true); validation.createPromptBox("직책 (선택)", "정회원, 코치, 감독, 총무, 회장 중 선택. 빈칸은 정회원으로 등록합니다."); }
                sheet.addValidationData(validation);
            }
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException exception) { throw new IllegalStateException("엑셀 양식을 생성하지 못했습니다.", exception); }
    }
}
