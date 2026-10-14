package com.jochookon.player;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.LocalDate;
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "players")
public class Player {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(name = "shirt_number")
    private Integer shirtNumber;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 2)
    private Position position;

    @Column(name = "joined_on")
    private LocalDate joinedOn;

    @Column(name = "birth_year")
    private Integer birthYear;

    // 팀 내 직책이며 로그인 권한(ADMIN/MEMBER)과는 관계없다.
    @Column(name = "club_role", nullable = false, length = 30)
    private String clubRole = ClubRoles.DEFAULT;

    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "first_choice", length = 3)
    private PreferredPosition firstChoice;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "second_choice", length = 3)
    private PreferredPosition secondChoice;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "third_choice", length = 3)
    private PreferredPosition thirdChoice;

    @Column(nullable = false)
    private boolean active = true;

    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "player_type", nullable = false, length = 6)
    private PlayerType playerType = PlayerType.MEMBER;

    @Version
    private Long version;

    protected Player() {
        // JPA가 조회한 데이터로 객체를 생성할 때 사용한다.
    }

    public static Player register(String name, Integer shirtNumber, Position position, LocalDate joinedOn) {
        Player player = new Player();
        player.updateDetails(name, shirtNumber, position, joinedOn);
        return player;
    }

    public void updateDetails(String name, Integer shirtNumber, Position position, LocalDate joinedOn) {
        if (name == null || name.isBlank() || name.strip().length() > 60) {
            throw new IllegalArgumentException("선수 이름은 1~60자여야 합니다.");
        }
        if (shirtNumber != null && (shirtNumber < 1 || shirtNumber > 99)) {
            throw new IllegalArgumentException("등번호는 1~99이거나 미등록이어야 합니다.");
        }
        if (joinedOn != null && (joinedOn.getYear() < 1000 || joinedOn.getYear() > 9999)) {
            throw new IllegalArgumentException("가입일은 1000년부터 9999년 사이의 날짜여야 합니다.");
        }
        Objects.requireNonNull(position, "포지션이 필요합니다.");
        this.name = name.strip();
        this.shirtNumber = shirtNumber;
        this.position = position;
        this.joinedOn = joinedOn;
    }

    public Long getId() { return id; }
    public void updatePreferences(PreferredPosition first, PreferredPosition second, PreferredPosition third) {
        if (position == Position.UN) {
            if (first != null || second != null || third != null) throw new IllegalArgumentException("포지션 미확인 선수의 선호 포지션은 비워 주세요.");
        } else PreferredPosition.validate(first, second, third);
        firstChoice = first;
        secondChoice = second;
        thirdChoice = third;
    }
    public PreferredPosition getFirstChoice() { return firstChoice; }
    public PreferredPosition getSecondChoice() { return secondChoice; }
    public PreferredPosition getThirdChoice() { return thirdChoice; }
    public String getName() { return name; }
    public Integer getShirtNumber() { return shirtNumber; }
    public Position getPosition() { return position; }
    public LocalDate getJoinedOn() { return joinedOn; }
    public void updateProfile(Integer birthYear, String clubRole) {
        int currentYear = java.time.Year.now(java.time.ZoneId.of("Asia/Seoul")).getValue();
        if (birthYear != null && (birthYear < 1900 || birthYear > currentYear)) throw new IllegalArgumentException("생년은 1900~" + currentYear + " 사이의 4자리 연도이거나 미확인이어야 합니다.");
        String normalizedRole = ClubRoles.normalize(clubRole);
        this.birthYear = birthYear;
        this.clubRole = normalizedRole;
    }
    public Integer getBirthYear() { return birthYear; }
    public String getClubRole() { return clubRole; }
    public boolean isActive() { return active; }
    public Long getVersion() { return version; }
    public PlayerType getPlayerType() { return playerType; }
    static Player registerGuest(GuestPlayerRequest request) {
        Position group = request.firstChoice() == null ? Position.UN : switch (request.firstChoice()) {
            case GK -> Position.GK;
            case LB, CB, RB -> Position.DF;
            case CDM, CM -> Position.MF;
            case LW, ST, RW -> Position.FW;
        };
        var player = register(request.name(), request.shirtNumber(), group, null);
        player.playerType = PlayerType.GUEST;
        player.updatePreferences(request.firstChoice(), request.secondChoice(), request.thirdChoice());
        player.updateProfile(request.birthYear(), ClubRoles.DEFAULT);
        return player;
    }
}
