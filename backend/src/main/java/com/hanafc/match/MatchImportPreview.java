package com.hanafc.match;

import java.util.List;

public record MatchImportPreview(List<Row> rows, List<MatchRequest.Quarter> quarters) {
    public boolean isValid() { return !rows.isEmpty() && rows.stream().allMatch(r -> r.errors().isEmpty()); }
    public record Row(int rowNumber, List<String> values, Long playerId, String name, Integer shirtNumber, List<String> errors, Integer birthYear, com.hanafc.player.PlayerType playerType) { }
}
