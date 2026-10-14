package com.hanafc.player;

import jakarta.validation.Validator;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class BulkPlayerService {
    public static final int MAX_ROWS = 200;
    private final PlayerRepository players;
    private final Validator validator;

    public BulkPlayerService(PlayerRepository players, Validator validator) {
        this.players = players;
        this.validator = validator;
    }

    public PlayerImportPreview preview(List<BulkPlayerRow> rows, List<Integer> rowNumbers) {
        if (rows == null || rows.isEmpty() || rows.size() > MAX_ROWS) {
            throw new IllegalArgumentException("한 번에 1~200명을 입력해 주세요.");
        }
        Set<String> names = rows.stream().filter(Objects::nonNull).map(row -> clean(row.name())).collect(Collectors.toSet());
        Set<String> existing = players.findByNameIn(names).stream().map(Player::getName).collect(Collectors.toSet());
        Map<String, Long> counts = rows.stream().filter(Objects::nonNull)
                .collect(Collectors.groupingBy(row -> clean(row.name()), Collectors.counting()));
        Map<Integer, Long> shirtCounts = rows.stream().filter(Objects::nonNull)
                .map(row -> comparableShirt(row.shirtNumber())).filter(Objects::nonNull)
                .collect(Collectors.groupingBy(number -> number, Collectors.counting()));
        Set<Integer> occupied = shirtCounts.isEmpty() ? Set.of() : players.findByActiveTrueAndShirtNumberIn(shirtCounts.keySet())
                .stream().map(Player::getShirtNumber).collect(Collectors.toSet());
        List<PlayerImportPreview.Row> result = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            BulkPlayerRow raw = rows.get(i);
            BulkPlayerRow row = raw == null ? null : new BulkPlayerRow(clean(raw.name()), clean(raw.position()).toUpperCase(Locale.ROOT), clean(raw.shirtNumber()), clean(raw.joinedOn()),
                    clean(raw.firstChoice()).toUpperCase(Locale.ROOT), clean(raw.secondChoice()).toUpperCase(Locale.ROOT), clean(raw.thirdChoice()).toUpperCase(Locale.ROOT), clean(raw.birthYear()), clean(raw.clubRole()));
            List<String> errors = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            try { toPlayer(row); } catch (IllegalArgumentException exception) { errors.add(exception.getMessage()); }
            Integer shirt = row == null ? null : comparableShirt(row.shirtNumber());
            if (shirt != null) {
                if (occupied.contains(shirt)) errors.add(DuplicateShirtNumberException.MESSAGE);
                if (shirtCounts.get(shirt) > 1) errors.add("이번 입력에 등번호 " + shirt + "번이 중복됩니다. 선수마다 다른 번호를 입력하거나 비워 주세요.");
            }
            if (row != null && !clean(row.name()).isEmpty()) {
                if (existing.contains(clean(row.name()))) warnings.add("같은 이름의 선수가 이미 있습니다. 동명이인인지 확인하세요.");
                if (counts.get(clean(row.name())) > 1) warnings.add("이번 입력에 같은 이름이 여러 번 있습니다.");
            }
            result.add(new PlayerImportPreview.Row(rowNumbers == null ? i + 1 : rowNumbers.get(i), row, errors, warnings));
        }
        return new PlayerImportPreview(result);
    }

    @Transactional
    public List<PlayerResponse> create(List<BulkPlayerRow> rows) {
        PlayerImportPreview preview = preview(rows, null);
        if (!preview.isValid()) throw new BulkValidationException(preview);
        // 모든 행을 먼저 검사하고 하나의 트랜잭션으로 저장한다. 일부 성공은 허용하지 않는다.
        List<Player> entities = rows.stream().map(this::toPlayer).toList();
        return players.saveAllAndFlush(entities).stream().map(PlayerResponse::from).toList();
    }

    private Player toPlayer(BulkPlayerRow row) {
        if (row == null) throw new IllegalArgumentException("선수 정보를 입력해 주세요.");
        if (clean(row.name()).startsWith("=")) throw new IllegalArgumentException("이름에는 수식을 사용할 수 없습니다. 값으로 입력해 주세요.");
        Position position = parseEnum(Position.class, row.position(), "기본 포지션은 GK/DF/MF/FW 또는 미확인 UN 중 선택해 주세요.");
        PreferredPosition first = optionalChoice(row.firstChoice());
        PreferredPosition second = optionalChoice(row.secondChoice());
        PreferredPosition third = optionalChoice(row.thirdChoice());
        Integer shirt = null;
        if (!clean(row.shirtNumber()).isEmpty()) {
            try {
                if (!clean(row.shirtNumber()).matches("[0-9]{1,2}")) throw new NumberFormatException();
                shirt = Integer.valueOf(clean(row.shirtNumber()));
            } catch (NumberFormatException exception) { throw new IllegalArgumentException("등번호는 1~99의 정수 또는 빈칸이어야 합니다."); }
        }
        LocalDate joined = null;
        if (!clean(row.joinedOn()).isEmpty()) {
            try {
                if (!clean(row.joinedOn()).matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) throw new DateTimeParseException("format", "", 0);
                joined = LocalDate.parse(clean(row.joinedOn()));
            } catch (DateTimeParseException exception) { throw new IllegalArgumentException("가입일은 YYYY-MM-DD 형식의 실제 날짜 또는 빈칸이어야 합니다."); }
        }
        Integer birthYear = null;
        if (!clean(row.birthYear()).isEmpty()) {
            if (!clean(row.birthYear()).matches("[0-9]{4}")) throw new IllegalArgumentException("생년은 4자리 연도 또는 빈칸이어야 합니다.");
            birthYear = Integer.valueOf(clean(row.birthYear()));
        }
        CreatePlayerRequest request = new CreatePlayerRequest(clean(row.name()), shirt, position, joined, first, second, third, birthYear, clean(row.clubRole()));
        String errors = validator.validate(request).stream().map(v -> v.getMessage()).sorted().collect(Collectors.joining(" "));
        if (!errors.isEmpty()) throw new IllegalArgumentException(errors);
        Player player = Player.register(request.name(), shirt, position, joined);
        player.updatePreferences(first, second, third);
        player.updateProfile(birthYear, row.clubRole());
        return player;
    }

    private PreferredPosition optionalChoice(String value) {
        return clean(value).isEmpty() ? null : parseEnum(PreferredPosition.class, value, "선호 포지션은 LB/CB/RB/CDM/CM/LW/ST/RW/GK만 가능합니다.");
    }
    private Integer comparableShirt(String value) {
        String number = clean(value);
        return number.matches("[0-9]{1,2}") ? Integer.valueOf(number) : null;
    }
    private <E extends Enum<E>> E parseEnum(Class<E> type, String value, String error) {
        try { return Enum.valueOf(type, clean(value).toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException exception) { throw new IllegalArgumentException(error); }
    }
    static String clean(String value) { return value == null ? "" : value.strip(); }
}
