package com.hanafc.player;

import jakarta.validation.constraints.*;

public record GuestPlayerRequest(@NotBlank @Size(max = 60) String name,
        @Min(1) @Max(99) Integer shirtNumber, @Min(1900) @Max(9999) Integer birthYear,
        PreferredPosition firstChoice, PreferredPosition secondChoice, PreferredPosition thirdChoice) { }
