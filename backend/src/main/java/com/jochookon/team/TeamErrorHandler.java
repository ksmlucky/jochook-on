package com.jochookon.team;

import com.jochookon.auth.AuthController;
import com.jochookon.auth.AccountRecoveryController;
import com.jochookon.auth.PasswordResetController;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = {TeamAccessController.class, TeamManagementController.class, TeamCoachController.class, TeamCodeController.class, AuthController.class, AccountRecoveryController.class, PasswordResetController.class})
public class TeamErrorHandler {
    @ExceptionHandler(TeamAccessException.class)
    ResponseEntity<?> access(TeamAccessException exception) {
        return ResponseEntity.status(exception.status()).body(Map.of("code", exception.code(), "message", exception.getMessage()));
    }
    @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class})
    ResponseEntity<?> invalid() { return ResponseEntity.badRequest().body(Map.of("code", "VALIDATION_ERROR", "message", "입력 내용을 확인해 주세요.")); }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<?> conflict() { return ResponseEntity.status(409).body(Map.of("code", "STATE_CHANGED", "message", "저장 상태가 변경되었습니다. 최신 상태를 확인해 주세요.")); }
}
