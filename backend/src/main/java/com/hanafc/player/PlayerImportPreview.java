package com.hanafc.player;

import java.util.List;

public record PlayerImportPreview(List<Row> rows) {
    public record Row(int rowNumber, BulkPlayerRow values, List<String> errors, List<String> warnings) { }
    public boolean isValid() { return !rows.isEmpty() && rows.stream().allMatch(row -> row.errors().isEmpty()); }
}
