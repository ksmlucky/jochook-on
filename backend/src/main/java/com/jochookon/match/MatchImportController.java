package com.jochookon.match;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/matches/import")
public class MatchImportController {
    private final MatchWorkbookService workbooks;
    public MatchImportController(MatchWorkbookService workbooks) { this.workbooks = workbooks; }
    @GetMapping("/template") ResponseEntity<byte[]> template() {
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=jochook-on-match.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).body(workbooks.template());
    }
    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    MatchImportPreview preview(@RequestParam("file") MultipartFile file) { return workbooks.preview(file); }
}
