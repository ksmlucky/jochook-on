package com.jochookon.match;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Arrays;
import java.util.List;
import tools.jackson.databind.json.JsonMapper;

@Converter
public class ScoringOrderConverter implements AttributeConverter<List<Integer>, String> {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    @Override public String convertToDatabaseColumn(List<Integer> value) {
        return value == null ? null : JSON.writeValueAsString(value);
    }
    @Override public List<Integer> convertToEntityAttribute(String value) {
        return value == null ? null : Arrays.stream(JSON.readValue(value, int[].class)).boxed().toList();
    }
}
