package com.hanafc.player;

class BulkValidationException extends RuntimeException {
    final PlayerImportPreview preview;
    BulkValidationException(PlayerImportPreview preview) {
        super("오류가 있는 행을 수정해 주세요. 아직 한 명도 등록하지 않았습니다.");
        this.preview = preview;
    }
}
