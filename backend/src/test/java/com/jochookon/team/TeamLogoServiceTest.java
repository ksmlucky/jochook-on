package com.jochookon.team;

import static org.assertj.core.api.Assertions.*;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;

class TeamLogoServiceTest {
    static MockMultipartFile picture(int width, int height, String format) throws Exception {
        var image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        var graphics = image.createGraphics(); graphics.setColor(Color.RED); graphics.fillRect(0, 0, width, height); graphics.dispose();
        var bytes = new ByteArrayOutputStream(); ImageIO.write(image, format, bytes);
        return new MockMultipartFile("file", "sample." + format, "image/" + format, bytes.toByteArray());
    }
    @ParameterizedTest @ValueSource(strings = {"png", "jpeg"})
    void reencodesToSquarePngWithTransparentContainment(String format) throws Exception {
        byte[] output = TeamLogoService.sanitize(picture(600, 300, format));
        var image = ImageIO.read(new ByteArrayInputStream(output));
        assertThat(image.getWidth()).isEqualTo(256); assertThat(image.getHeight()).isEqualTo(256);
        assertThat(image.getRGB(128, 0) >>> 24).isZero();
        var center = new Color(image.getRGB(128, 128), true);
        assertThat(center.getAlpha()).isEqualTo(255);
        assertThat(center.getRed()).isGreaterThan(250); assertThat(center.getGreen()).isLessThan(4);
        assertThat(output[0]).isEqualTo((byte) 0x89);
    }
    @Test void rejectsUnsupportedMalformedEmptyAndOversizedBytes() throws Exception {
        for (var file : new MockMultipartFile[]{
                new MockMultipartFile("file", "a.svg", "image/png", "<svg/>".getBytes()),
                new MockMultipartFile("file", new byte[0]),
                new MockMultipartFile("file", new byte[TeamLogoService.MAX_BYTES + 1]), picture(2, 2, "gif")}) {
            assertThatThrownBy(() -> TeamLogoService.sanitize(file)).isInstanceOf(TeamAccessException.class)
                    .satisfies(error -> assertThat(((TeamAccessException) error).status()).isEqualTo(400));
        }
    }
    @Test void rejectsDeclaredDimensionsBeforeLargeDecode() throws Exception {
        assertThatThrownBy(() -> TeamLogoService.sanitize(picture(4097, 1, "png")))
                .isInstanceOf(TeamAccessException.class).hasMessageContaining("4096");
    }
}
