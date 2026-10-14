package com.hanafc.player;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/players")
public class PlayerImportController {
    private final BulkPlayerService bulk;
    private final PlayerWorkbookService workbooks;
    public PlayerImportController(BulkPlayerService bulk, PlayerWorkbookService workbooks) {
        this.bulk = bulk;
        this.workbooks = workbooks;
    }
    @PostMapping("/bulk/preview")
    PlayerImportPreview preview(@Valid @RequestBody BulkPlayerRequest request) { return bulk.preview(request.rows(), null); }
    @PostMapping("/bulk")
    ResponseEntity<List<PlayerResponse>> create(@Valid @RequestBody BulkPlayerRequest request) {
        return ResponseEntity.status(201).body(bulk.create(request.rows()));
    }
    @PostMapping(value = "/import/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    PlayerImportPreview upload(@RequestParam("file") MultipartFile file) { return workbooks.preview(file); }
    @GetMapping("/import/template")
    ResponseEntity<byte[]> template() {
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=hana-fc-players.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(workbooks.template());
    }
}
