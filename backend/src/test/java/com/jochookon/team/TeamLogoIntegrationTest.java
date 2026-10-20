package com.jochookon.team;

import static org.assertj.core.api.Assertions.*;
import java.io.ByteArrayInputStream;
import javax.imageio.ImageIO;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

@Tag("integration") @Testcontainers
class TeamLogoIntegrationTest {
    @Container static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @Test void migrationAndRoundtripKeepTeamLogosIsolated() throws Exception {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()));
        jdbc.update("INSERT INTO teams(id,name,status) VALUES(2,'Logo fixture B','ACTIVE')");
        var service = new TeamLogoService(jdbc);
        service.save(1, TeamLogoServiceTest.picture(60, 30, "png"));
        assertThat(ImageIO.read(new ByteArrayInputStream(service.find(1))).getWidth()).isEqualTo(256);
        assertThatThrownBy(() -> service.find(2)).isInstanceOf(TeamAccessException.class);
        service.save(2, TeamLogoServiceTest.picture(30, 60, "jpeg"));
        byte[] other = service.find(2);
        service.save(1, TeamLogoServiceTest.picture(20, 20, "jpeg"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM team_logos", Integer.class)).isEqualTo(2);
        service.delete(1);
        assertThatThrownBy(() -> service.find(1)).isInstanceOf(TeamAccessException.class);
        assertThat(service.find(2)).isEqualTo(other);
        jdbc.update("DELETE FROM teams WHERE id=2");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM team_logos", Integer.class)).isZero();
    }
}
