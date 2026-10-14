package com.hanafc.player;

class DuplicateShirtNumberException extends RuntimeException {
    static final String MESSAGE = "활동 중인 선수가 이미 사용하는 등번호입니다. 다른 번호를 입력하거나 비워 주세요.";
    DuplicateShirtNumberException() { super(MESSAGE); }
}
