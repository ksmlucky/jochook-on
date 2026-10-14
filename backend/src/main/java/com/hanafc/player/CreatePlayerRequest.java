package com.hanafc.player;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record CreatePlayerRequest(
        @NotBlank(message = "이름을 입력해 주세요.") @Size(max = 60, message = "이름은 60자 이내로 입력해 주세요.") String name,
        @Min(value = 1, message = "등번호는 1~99로 입력해 주세요.") @Max(value = 99, message = "등번호는 1~99로 입력해 주세요.") Integer shirtNumber,
        @NotNull(message = "포지션을 선택해 주세요.") Position position,
        LocalDate joinedOn,
        PreferredPosition firstChoice,
        PreferredPosition secondChoice, PreferredPosition thirdChoice,
        @Min(1900) @Max(9999) Integer birthYear, @Size(max = 30) String clubRole) {
    public CreatePlayerRequest { if (name != null) name = name.strip(); }
    @jakarta.validation.constraints.AssertTrue(message = "포지션 미확인(UN)은 선호를 비우고, 나머지 포지션은 1지망을 입력해 주세요.")
    public boolean isPreferenceSelectionValid() {
        return position == Position.UN ? firstChoice == null && secondChoice == null && thirdChoice == null : firstChoice != null;
    }
}
