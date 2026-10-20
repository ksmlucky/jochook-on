package com.jochookon.team;

import java.awt.AlphaComposite;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import javax.imageio.ImageIO;
import javax.imageio.stream.MemoryCacheImageInputStream;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class TeamLogoService {
    static final int MAX_BYTES = 2 * 1024 * 1024;
    private final JdbcTemplate jdbc;
    public TeamLogoService(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    @Transactional(readOnly = true)
    public byte[] find(long teamId) {
        return jdbc.query("SELECT png_data FROM team_logos WHERE team_id = ?", (row, index) -> row.getBytes(1), teamId)
                .stream().findFirst().orElseThrow(() -> new TeamAccessException(404, "LOGO_NOT_FOUND", "등록된 팀 로고가 없습니다."));
    }
    @Transactional
    public void save(long teamId, MultipartFile file) {
        byte[] png = sanitize(file);
        jdbc.update("INSERT INTO team_logos(team_id, png_data) VALUES(?, ?) ON DUPLICATE KEY UPDATE png_data = ?, updated_at = CURRENT_TIMESTAMP(6)", teamId, png, png);
    }
    @Transactional
    public void delete(long teamId) { jdbc.update("DELETE FROM team_logos WHERE team_id = ?", teamId); }
    static byte[] sanitize(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES) throw invalid("2MB 이하의 PNG 또는 JPG 이미지를 선택해 주세요.");
        try (var source = file.getInputStream()) {
            byte[] data = source.readNBytes(MAX_BYTES + 1);
            if (data.length > MAX_BYTES) throw invalid("2MB 이하의 이미지를 선택해 주세요.");
            try (var input = new MemoryCacheImageInputStream(new ByteArrayInputStream(data))) {
                var readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext()) throw invalid("PNG 또는 JPG 이미지만 사용할 수 있습니다.");
                var reader = readers.next();
                try {
                    String format = reader.getFormatName();
                    if (!format.equalsIgnoreCase("png") && !format.equalsIgnoreCase("jpeg")) throw invalid("PNG 또는 JPG 이미지만 사용할 수 있습니다.");
                    reader.setInput(input, true, true);
                    int width = reader.getWidth(0), height = reader.getHeight(0);
                    if (width < 1 || height < 1 || width > 4096 || height > 4096 || (long) width * height > 16_777_216L)
                        throw invalid("가로·세로 4096px 이하의 이미지를 선택해 주세요.");
                    // Inspect dimensions before allocation, then decode at a bounded resolution.
                    var param = reader.getDefaultReadParam();
                    int sampling = Math.max(1, Math.max(width, height) / 512);
                    param.setSourceSubsampling(sampling, sampling, 0, 0);
                    BufferedImage decoded = reader.read(0, param);
                    BufferedImage target = new BufferedImage(256, 256, BufferedImage.TYPE_INT_ARGB);
                    var graphics = target.createGraphics();
                    try {
                        graphics.setComposite(AlphaComposite.Src);
                        graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                        double ratio = Math.min(256d / decoded.getWidth(), 256d / decoded.getHeight());
                        int w = Math.max(1, (int) Math.round(decoded.getWidth() * ratio));
                        int h = Math.max(1, (int) Math.round(decoded.getHeight() * ratio));
                        graphics.drawImage(decoded, (256 - w) / 2, (256 - h) / 2, w, h, null);
                    } finally { graphics.dispose(); decoded.flush(); }
                    try (var output = new ByteArrayOutputStream()) {
                        ImageIO.write(target, "png", output);
                        target.flush();
                        return output.toByteArray();
                    }
                } finally { reader.dispose(); }
            }
        } catch (IOException | IllegalArgumentException exception) {
            throw invalid("이미지를 읽을 수 없습니다. 다른 PNG 또는 JPG 파일을 선택해 주세요.");
        }
    }
    private static TeamAccessException invalid(String message) { return new TeamAccessException(400, "INVALID_LOGO", message); }
}
