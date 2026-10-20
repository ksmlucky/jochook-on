package com.jochookon.match;

import java.util.Arrays;
import java.util.List;
import tools.jackson.databind.json.JsonMapper;

/** JSON boundary codec; deliberately not a JPA collection-valued converter. */
public class ScoringOrderConverter {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    public String convertToDatabaseColumn(List<Integer> value) {
        return value == null ? null : JSON.writeValueAsString(value);
    }
    public List<Integer> convertToEntityAttribute(String value) {
        return value == null ? null : Arrays.stream(JSON.readValue(value, int[].class)).boxed().toList();
    }
}
