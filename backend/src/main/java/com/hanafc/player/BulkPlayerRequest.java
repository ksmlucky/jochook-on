package com.hanafc.player;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record BulkPlayerRequest(@NotEmpty @Size(max = 200) List<@NotNull BulkPlayerRow> rows) { }
