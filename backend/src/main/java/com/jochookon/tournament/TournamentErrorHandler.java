package com.jochookon.tournament;

import java.util.*;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

@RestControllerAdvice(assignableTypes = TournamentController.class)
public class TournamentErrorHandler {
    record ApiError(String code, String message, Map<String, String> fieldErrors) { }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validation(MethodArgumentNotValidException ex) {
        var fields = new LinkedHashMap<String, String>();
        ex.getBindingResult().getFieldErrors().forEach(e -> fields.putIfAbsent(e.getField(), e.getDefaultMessage()));
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_ERROR", "대회 입력값을 확인해 주세요.", fields));
    }
    @ExceptionHandler({HandlerMethodValidationException.class, HttpMessageNotReadableException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    ResponseEntity<ApiError> malformed() { return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST", "날짜와 숫자 형식을 확인해 주세요.", Map.of())); }
    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiError> invalid(IllegalArgumentException ex) { return ResponseEntity.badRequest().body(new ApiError("VALIDATION_ERROR", ex.getMessage(), Map.of())); }
    @ExceptionHandler(OptimisticLockingFailureException.class)
    ResponseEntity<ApiError> conflict() { return ResponseEntity.status(409).body(new ApiError("TOURNAMENT_CONFLICT", "다른 운영진이 먼저 수정했습니다. 최신 대회를 다시 열어 주세요.", Map.of())); }
}
