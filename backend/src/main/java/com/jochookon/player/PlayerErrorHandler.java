package com.jochookon.player;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

@RestControllerAdvice(assignableTypes = {PlayerController.class, PlayerImportController.class, GuestPlayerController.class})
@Order(Ordered.HIGHEST_PRECEDENCE)
public class PlayerErrorHandler {
    record ApiError(String code, String message, Map<String, String> fieldErrors) { }

    @ExceptionHandler(DuplicateShirtNumberException.class)
    ResponseEntity<ApiError> duplicateShirt() {
        return ResponseEntity.badRequest().body(new ApiError("DUPLICATE_SHIRT_NUMBER", DuplicateShirtNumberException.MESSAGE,
                Map.of("shirtNumber", DuplicateShirtNumberException.MESSAGE)));
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    ResponseEntity<ApiError> databaseConstraint(org.springframework.dao.DataIntegrityViolationException exception) {
        // 사전 조회 직후 다른 요청이 같은 번호를 저장한 경우에도 DB UNIQUE가 최종 차단한다.
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause.getMessage() != null && (cause.getMessage().contains("uq_players_team_active_shirt")
                    || cause.getMessage().contains("uq_players_active_shirt"))) return duplicateShirt();
        }
        return ResponseEntity.badRequest().body(new ApiError("DATA_CONSTRAINT", "저장할 수 없는 선수 정보입니다. 입력 내용을 확인해 주세요.", Map.of()));
    }

    @ExceptionHandler(BulkValidationException.class)
    ResponseEntity<?> bulkValidation(BulkValidationException exception) {
        return ResponseEntity.badRequest().body(Map.of("code", "BULK_VALIDATION_ERROR", "message", exception.getMessage(), "rows", exception.preview.rows()));
    }

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    ResponseEntity<ApiError> tooLarge() {
        return ResponseEntity.status(413).body(new ApiError("FILE_TOO_LARGE", "엑셀 파일은 2MB 이하여야 합니다.", Map.of()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validation(MethodArgumentNotValidException exception) {
        Map<String, String> fields = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors().forEach(error -> fields.putIfAbsent(error.getField(), error.getDefaultMessage()));
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_ERROR", "입력 내용을 확인해 주세요.", fields));
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    ResponseEntity<ApiError> methodValidation(HandlerMethodValidationException exception) {
        Map<String, String> fields = new LinkedHashMap<>();
        exception.getBeanResults().forEach(result -> result.getFieldErrors()
                .forEach(error -> fields.putIfAbsent(error.getField(), error.getDefaultMessage())));
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_ERROR", "입력 내용을 확인해 주세요.", fields));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> malformed() {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST", "포지션, 숫자 또는 날짜 형식을 확인해 주세요.", Map.of()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiError> invalidValue(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_ERROR", exception.getMessage(), Map.of()));
    }

    @ExceptionHandler(PlayerNotFoundException.class)
    ResponseEntity<ApiError> notFound(PlayerNotFoundException exception) {
        return ResponseEntity.status(404).body(new ApiError("PLAYER_NOT_FOUND", exception.getMessage(), Map.of()));
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    ResponseEntity<ApiError> conflict() {
        return ResponseEntity.status(409).body(new ApiError("PLAYER_CONFLICT",
                "다른 운영진이 먼저 수정했습니다. 최신 정보를 확인한 뒤 다시 수정해 주세요.", Map.of()));
    }
}
