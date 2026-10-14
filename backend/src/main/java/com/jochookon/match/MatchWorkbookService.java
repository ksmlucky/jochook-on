package com.jochookon.match;

import com.jochookon.team.TeamContext;

import com.jochookon.player.Player;
import com.jochookon.player.PlayerRepository;
import java.io.*;
import java.math.BigDecimal;
import java.util.*;
import java.util.zip.ZipInputStream;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MatchWorkbookService {
    static final String[] HEADERS = {"쿼터 (필수)", "포지션 (필수)", "출전 구분 (필수)", "이름 (필수)", "등번호 (선택)", "득점 (선택: 기본 0)", "도움 (선택: 기본 0)", "선수 ID (선택)"};
    private final PlayerRepository players;
    public MatchWorkbookService(PlayerRepository players) { this.players = players; }

    private static class Parsed {
        int rowNumber, quarter, order, goals, assists;
        LineupSlot slot;
        Player player;
        List<String> values;
        List<String> errors = new ArrayList<>();
    }

    @Transactional(readOnly = true)
    public MatchImportPreview preview(MultipartFile file) {
        if (file.isEmpty() || file.getSize() > 2 * 1024 * 1024 || file.getOriginalFilename() == null || !file.getOriginalFilename().toLowerCase(Locale.ROOT).endsWith(".xlsx"))
            throw new IllegalArgumentException("2MB 이하의 .xlsx 경기 양식을 선택해 주세요.");
        List<Parsed> rows = new ArrayList<>();
        try {
            byte[] bytes = file.getBytes(); checkArchive(bytes);
            try (var book = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
                if (book.getNumberOfSheets() < 1 || book.getNumberOfSheets() > 2 || book.getSheet("쿼터기록") == null
                        || (book.getNumberOfSheets() == 2 && book.getSheet("작성안내") == null)) throw new IllegalArgumentException("다운로드한 쿼터기록 양식을 사용해 주세요. 추가 데이터 시트는 지원하지 않습니다.");
                Sheet sheet = book.getSheet("쿼터기록"); Row header = sheet.getRow(0);
                for (int i = 0; i < HEADERS.length; i++) if (header == null || !HEADERS[i].equals(value(header.getCell(i)))) throw new IllegalArgumentException("첫 행의 제목과 열 순서를 양식과 동일하게 유지해 주세요.");
                for (Row row : sheet) {
                    if (row.getRowNum() == 0) continue;
                    List<String> values = new ArrayList<>();
                    for (int i = 0; i < HEADERS.length; i++) values.add(value(row.getCell(i)));
                    boolean formula = false;
                    for (Cell cell : row) {
                        formula |= cell.getCellType() == CellType.FORMULA;
                        if (cell.getColumnIndex() >= HEADERS.length && !value(cell).isBlank()) throw new IllegalArgumentException("양식의 8개 열 밖에 입력된 값이 있습니다.");
                    }
                    // 미리 채운 쿼터·자리·선발/교체만 있고 선수/스탯이 비어 있으면 빈 배치이다.
                    if (!formula && values.subList(3, 8).stream().allMatch(String::isBlank)) continue;
                    if (rows.size() == 88) throw new IllegalArgumentException("경기 양식은 4쿼터 × 11자리 × 선발/교체, 최대 88행입니다.");
                    Parsed parsed = new Parsed(); parsed.rowNumber = row.getRowNum() + 1; parsed.values = values;
                    if (formula) parsed.errors.add("수식은 지원하지 않습니다. 값으로 붙여넣어 주세요.");
                    rows.add(parsed);
                }
            }
        } catch (IllegalArgumentException e) { throw e; }
        catch (Exception e) { throw new IllegalArgumentException("경기 엑셀을 읽지 못했습니다. 암호가 없는 .xlsx 양식인지 확인해 주세요."); }
        if (rows.isEmpty()) throw new IllegalArgumentException("입력한 선수가 없습니다. 이름을 입력한 뒤 올려 주세요.");
        var candidates = players.findByTeamIdAndNameIn(TeamContext.requireTeamId(), rows.stream().map(r -> r.values.get(3)).distinct().toList());
        for (Parsed row : rows) {
            if (!row.errors.isEmpty()) continue;
            try {
                row.quarter = integer(row.values.get(0), 1, 4, "쿼터", false);
                try { row.slot = LineupSlot.valueOf(row.values.get(1).toUpperCase(Locale.ROOT)); }
                catch (IllegalArgumentException e) { throw new IllegalArgumentException("포지션은 양식 목록에서 선택해 주세요. CB는 LCB/RCB, CM은 LCM/RCM으로 구분합니다."); }
                row.order = switch (row.values.get(2)) { case "선발" -> 0; case "교체" -> 1; default -> throw new IllegalArgumentException("출전 구분은 선발 또는 교체여야 합니다."); };
                String name = row.values.get(3);
                if (name.isBlank() || name.length() > 60) throw new IllegalArgumentException("이름은 필수이며 60자 이하여야 합니다.");
                Integer shirt = row.values.get(4).isBlank() ? null : integer(row.values.get(4), 1, 99, "등번호", false);
                row.goals = integer(row.values.get(5), 0, 99, "득점", true);
                row.assists = integer(row.values.get(6), 0, 99, "도움", true);
                Long id = null;
                if (!row.values.get(7).isBlank()) {
                    try { id = Long.valueOf(row.values.get(7)); if (id <= 0) throw new NumberFormatException(); }
                    catch (NumberFormatException e) { throw new IllegalArgumentException("선수 ID는 양의 정수여야 합니다."); }
                }
                final Long playerId = id;
                var matches = candidates.stream().filter(p -> p.getName().equals(name) && (shirt == null || shirt.equals(p.getShirtNumber())) && (playerId == null || playerId.equals(p.getId()))).toList();
                if (matches.isEmpty()) throw new IllegalArgumentException("등록된 선수와 이름·등번호·ID가 일치하지 않습니다. 선수단에 먼저 등록하거나 입력을 확인해 주세요.");
                if (matches.size() > 1) throw new IllegalArgumentException("동명이인을 구분할 수 없습니다. 등번호 또는 선수 ID를 입력해 주세요.");
                row.player = matches.getFirst();
            } catch (IllegalArgumentException e) { row.errors.add(e.getMessage()); }
        }
        validateRows(rows);
        List<MatchRequest.Quarter> quarters = new ArrayList<>();
        if (rows.stream().allMatch(r -> r.errors.isEmpty())) {
            for (int number = 1; number <= 4; number++) {
                final int q = number;
                quarters.add(new MatchRequest.Quarter(q, rows.stream().filter(r -> r.quarter == q).map(r -> new MatchRequest.Appearance(r.slot, r.player.getId(), r.goals, r.assists, r.order)).toList()));
            }
        }
        return new MatchImportPreview(rows.stream().map(r -> new MatchImportPreview.Row(r.rowNumber, r.values, r.player == null ? null : r.player.getId(), r.player == null ? null : r.player.getName(), r.player == null ? null : r.player.getShirtNumber(), List.copyOf(r.errors), r.player == null ? null : r.player.getBirthYear(), r.player == null ? null : r.player.getPlayerType())).toList(), quarters);
    }

    private void validateRows(List<Parsed> rows) {
        var parsed = rows.stream().filter(r -> r.errors.isEmpty()).toList();
        Map<String, List<Parsed>> positions = new HashMap<>(), people = new HashMap<>();
        for (var r : parsed) {
            positions.computeIfAbsent(r.quarter + ":" + r.slot + ":" + r.order, key -> new ArrayList<>()).add(r);
            people.computeIfAbsent(r.quarter + ":" + r.player.getId(), key -> new ArrayList<>()).add(r);
        }
        positions.values().stream().filter(group -> group.size() > 1).forEach(group -> group.forEach(r -> r.errors.add("같은 쿼터·포지션·출전 구분이 중복됩니다.")));
        people.values().stream().filter(group -> group.size() > 1).forEach(group -> group.forEach(r -> r.errors.add("같은 쿼터에 같은 선수를 두 번 입력할 수 없습니다.")));
        for (var r : parsed) if (r.order == 1 && parsed.stream().noneMatch(s -> s.quarter == r.quarter && s.slot == r.slot && s.order == 0)) r.errors.add("같은 쿼터·포지션의 선발 선수를 먼저 입력해 주세요.");
        for (int q = 1; q <= 4; q++) {
            final int number = q;
            var group = parsed.stream().filter(r -> r.quarter == number).toList();
            if (group.stream().mapToInt(r -> r.assists).sum() > group.stream().mapToInt(r -> r.goals).sum()) group.forEach(r -> r.errors.add("이 쿼터의 도움 합계가 득점 합계보다 많습니다."));
        }
    }
    private int integer(String text, int min, int max, String label, boolean blankZero) {
        if (blankZero && text.isBlank()) return 0;
        try { int value = Integer.parseInt(text); if (value >= min && value <= max) return value; } catch (NumberFormatException ignored) { }
        throw new IllegalArgumentException(label + "은 " + min + "~" + max + " 정수여야 합니다.");
    }
    private String value(Cell cell) {
        if (cell == null || cell.getCellType() == CellType.BLANK) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().strip();
            case NUMERIC -> BigDecimal.valueOf(cell.getNumericCellValue()).stripTrailingZeros().toPlainString();
            case FORMULA -> "=" + cell.getCellFormula();
            default -> new DataFormatter(Locale.ROOT).formatCellValue(cell);
        };
    }
    private void checkArchive(byte[] bytes) throws IOException {
        try (var zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            int entries = 0; long expanded = 0; byte[] buffer = new byte[8192];
            for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                if (++entries > 300 || entry.getName().toLowerCase(Locale.ROOT).contains("vbaproject")) throw new IllegalArgumentException("매크로나 복잡한 파일은 지원하지 않습니다.");
                for (int read; (read = zip.read(buffer)) != -1;) { expanded += read; if (expanded > 20 * 1024 * 1024) throw new IllegalArgumentException("엑셀 내부 데이터가 너무 큽니다."); }
            }
        }
    }
    public byte[] template() {
        try (var book = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            Sheet sheet = book.createSheet("쿼터기록"); sheet.createFreezePane(3, 1);
            Font font = book.createFont(); font.setBold(true); font.setColor(IndexedColors.WHITE.getIndex());
            CellStyle header = book.createCellStyle(); header.setFont(font); header.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex()); header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            CellStyle text = book.createCellStyle(); text.setDataFormat(book.createDataFormat().getFormat("@"));
            Row first = sheet.createRow(0); first.setHeightInPoints(28);
            for (int i = 0; i < HEADERS.length; i++) { first.createCell(i).setCellValue(HEADERS[i]); first.getCell(i).setCellStyle(header); sheet.setColumnWidth(i, (i == 3 ? 26 : 24) * 256); sheet.setDefaultColumnStyle(i, text); }
            int row = 1;
            for (int q = 1; q <= 4; q++) for (var slot : LineupSlot.values()) for (String type : List.of("선발", "교체")) {
                Row r = sheet.createRow(row++); r.createCell(0).setCellValue(q); r.createCell(1).setCellValue(slot.name()); r.createCell(2).setCellValue(type);
            }
            var helper = sheet.getDataValidationHelper();
            String[][] options = {{"1", "2", "3", "4"}, Arrays.stream(LineupSlot.values()).map(Enum::name).toArray(String[]::new), {"선발", "교체"}};
            for (int column = 0; column < options.length; column++) {
                var validation = helper.createValidation(helper.createExplicitListConstraint(options[column]), new CellRangeAddressList(1, 200, column, column));
                validation.setShowErrorBox(true); validation.createErrorBox("입력 확인", "목록에서 선택해 주세요."); sheet.addValidationData(validation);
            }
            Sheet guide = book.createSheet("작성안내"); guide.setColumnWidth(0, 120 * 256);
            String[] instructions = {"조축ON · 1~4쿼터 경기 기록 양식", "쿼터기록 시트의 이름부터 입력하세요. 빈 선수 행은 제외합니다. 열 제목은 유지해 주세요.",
                    "포지션: GK, LB, LCB(왼쪽 CB), RCB(오른쪽 CB), RB, CDM, LCM(왼쪽 CM), RCM(오른쪽 CM), LW, ST, RW.",
                    "같은 쿼터·포지션에서 선발 1명 + 교체 1명 = 각각 0.5쿼터. 교체 없이 선발만 기록하면 1쿼터입니다.",
                    "교체 행이 있으면 같은 자리의 선발도 필요합니다. 한 선수는 같은 쿼터에 한 번만 기록합니다. 재투입·포지션 이동은 지원하지 않습니다.",
                    "등번호는 선택이며 1~99번만 가능합니다. 모르면 빈칸으로 두세요. 동명이인은 등번호 또는 선수 ID로 구분하세요.",
                    "이름은 선수단에 등록된 이름과 같아야 합니다. 없는 선수는 먼저 등록합니다. 이 파일은 선수를 새로 만들지 않습니다.",
                    "득점·도움: 0~99 정수, 빈칸은 0. 교체 전/후 각 선수에게 귀속된 기록을 입력하세요. 수식은 사용하지 않습니다.",
                    "미리보기 → 4쿼터 초안에 반영 → 실제 출석 확인 → 경기 기록 저장. 반영은 기존 4쿼터 초안을 교체합니다.",
                    "투표와 실제 출석은 자동 변경하지 않습니다. 새 참가자는 미확인 상태로 추가되므로 출석을 확인하세요.",
                    "쿼터 길이와 교체 시각은 입력하지 않습니다. 프로 선수와의 경기당 비교 기준은 추후 결정합니다."};
            for (int i = 0; i < instructions.length; i++) guide.createRow(i).createCell(0).setCellValue(instructions[i]);
            book.write(output); return output.toByteArray();
        } catch (IOException e) { throw new IllegalStateException("경기 엑셀 양식을 만들지 못했습니다.", e); }
    }
}
