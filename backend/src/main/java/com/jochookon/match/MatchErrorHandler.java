package com.jochookon.match;

import java.util.*;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

@RestControllerAdvice(assignableTypes = {MatchController.class, MatchImportController.class, LineupSuggestionController.class})
@org.springframework.core.annotation.Order(org.springframework.core.Ordered.HIGHEST_PRECEDENCE)
public class MatchErrorHandler {
    record ApiError(String code, String message, Map<String, String> fieldErrors) { }
    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    ResponseEntity<ApiError> tooLarge() { return ResponseEntity.status(413).body(new ApiError("FILE_TOO_LARGE", "경기 엑셀은 2MB 이하여야 합니다.", Map.of())); }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validation(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(e -> fields.putIfAbsent(e.getField(), e.getDefaultMessage()));
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_ERROR", "날짜·필수 시간·스코어·명단·쿼터 입력값과 범위를 확인해 주세요.", fields));
    }
    @ExceptionHandler({HandlerMethodValidationException.class, HttpMessageNotReadableException.class})
    ResponseEntity<ApiError> malformed() { return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST", "날짜, 숫자 또는 상태 값 형식을 확인해 주세요.", Map.of())); }
    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiError> invalid(IllegalArgumentException ex) { return ResponseEntity.badRequest().body(new ApiError("VALIDATION_ERROR", ex.getMessage(), Map.of())); }
    @ExceptionHandler(MatchNotFoundException.class)
    ResponseEntity<ApiError> missing(MatchNotFoundException ex) { return ResponseEntity.status(404).body(new ApiError("MATCH_NOT_FOUND", ex.getMessage(), Map.of())); }
    @ExceptionHandler(OptimisticLockingFailureException.class)
    ResponseEntity<ApiError> conflict() { return ResponseEntity.status(409).body(new ApiError("MATCH_CONFLICT", "다른 운영진이 먼저 수정했습니다. 입력 내용을 보관한 뒤 최신 기록을 다시 열어 주세요.", Map.of())); }
}
