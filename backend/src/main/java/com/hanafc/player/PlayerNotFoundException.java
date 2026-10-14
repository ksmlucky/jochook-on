package com.hanafc.player;

class PlayerNotFoundException extends RuntimeException {
    PlayerNotFoundException() { super("해당 선수를 찾을 수 없습니다."); }
}
