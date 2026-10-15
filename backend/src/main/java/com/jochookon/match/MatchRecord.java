package com.jochookon.match;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

@Entity
@Table(name = "match_records")
public class MatchRecord {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "team_id", nullable = false, updatable = false) private Long teamId;
    @Version private Long version;
    @Column(name = "played_on", nullable = false) private LocalDate playedOn;
    private LocalTime kickoff;
    @Column(name = "score_for") private Integer scoreFor;
    @Column(name = "score_against") private Integer scoreAgainst;
    @Enumerated(EnumType.STRING) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR)
    @Column(name = "match_kind", nullable = false, length = 16) private MatchKind kind;
    @Enumerated(EnumType.STRING) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR)
    @Column(name = "recording_stage", length = 16) private RecordingStage recordingStage;
    @Enumerated(EnumType.STRING) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR)
    @Column(name = "formation_a", nullable = false, length = 8) private Formation formationA;
    @Enumerated(EnumType.STRING) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR)
    @Column(name = "formation_b", nullable = false, length = 8) private Formation formationB;
    @Column(nullable = false, length = 100) private String venue;
    @Column(nullable = false, length = 100) private String opponent;
    @Column(nullable = false, length = 3000) private String notes;
    // 경기와 함께 저장되는 값 객체 목록. 컬렉션 수정에도 경기 version이 증가한다.
    @ElementCollection @CollectionTable(name = "match_participants", joinColumns = @JoinColumn(name = "match_id"))
    private List<MatchParticipant> participants = new ArrayList<>();
    @ElementCollection @CollectionTable(name = "match_quarters", joinColumns = @JoinColumn(name = "match_id"))
    private List<MatchQuarter> quarters = new ArrayList<>();
    @ElementCollection @CollectionTable(name = "match_appearances", joinColumns = @JoinColumn(name = "match_id"))
    private List<MatchAppearance> appearances = new ArrayList<>();
    @ElementCollection @CollectionTable(name = "match_planned_lineups", joinColumns = @JoinColumn(name = "match_id"))
    private List<PlannedLineup> plannedLineup = new ArrayList<>();
    protected MatchRecord() { }
    static MatchRecord create(MatchRequest request) {
        var match = new MatchRecord(); match.recordingStage = RecordingStage.ATTENDANCE;
        match.replace(request); return match;
    }
    void replace(MatchRequest request) {
        request = request.resolveFormations(formationA, formationB);
        validateRules(request);
        if (id != null && kind != request.kind()) throw new IllegalArgumentException("저장한 경기의 유형은 변경할 수 없습니다. 별도 경기로 등록해 주세요.");
        kind = request.kind();
        formationA = request.formationA(); formationB = request.formationB();
        // Older clients omit this field: preserve the saved checkpoint, including legacy NULL.
        if (request.recordingStage() != null) recordingStage = request.recordingStage();
        playedOn = request.playedOn(); kickoff = request.kickoff();
        scoreFor = request.scoreFor(); scoreAgainst = request.scoreAgainst();
        venue = request.venue().strip(); opponent = request.opponent().strip(); notes = request.notes().strip();
        participants.clear(); quarters.clear(); appearances.clear(); plannedLineup.clear();
        request.plannedLineup().forEach(entry -> plannedLineup.add(new PlannedLineup(entry)));
        request.participants().forEach(p -> participants.add(new MatchParticipant(p)));
        request.quarters().forEach(q -> {
            quarters.add(new MatchQuarter(q));
            q.lineup().forEach(a -> appearances.add(new MatchAppearance(q.number(), a)));
        });
    }
    static void validateRules(MatchRequest request) {
        if (request.kind() == MatchKind.EXTERNAL && request.formation(MatchTeam.B) != Formation.F4123)
            throw new IllegalArgumentException("외부 경기에는 상대 팀 포메이션을 지정하지 않습니다.");
        if (request.kind() == MatchKind.INTERNAL && !request.opponent().isBlank()) throw new IllegalArgumentException("자체전은 상대 팀 이름 대신 A팀·B팀으로 기록합니다.");
        if (request.kickoff() == null || request.kickoff().getMinute() % 30 != 0
                || request.kickoff().getSecond() != 0 || request.kickoff().getNano() != 0)
            throw new IllegalArgumentException("시작 시간은 필수이며 30분 단위로 선택해 주세요.");
        if ((request.scoreFor() == null) != (request.scoreAgainst() == null))
            throw new IllegalArgumentException("스코어는 양쪽을 모두 입력하거나 모두 비워 주세요.");
        if (request.scoreFor() != null && (request.scoreFor() < 0 || request.scoreFor() > 99 || request.scoreAgainst() < 0 || request.scoreAgainst() > 99))
            throw new IllegalArgumentException("스코어는 0~99 사이로 입력해 주세요.");
        if (request.playedOn().getYear() < 1000 || request.playedOn().getYear() > 9999) throw new IllegalArgumentException("경기 날짜는 1000~9999년 사이여야 합니다.");
        Map<Long, Attendance> attendees = new HashMap<>();
        for (var p : request.participants()) {
            if (attendees.put(p.playerId(), p.attendance()) != null) throw new IllegalArgumentException("같은 선수를 참가 명단에 두 번 넣을 수 없습니다.");
        }
        Set<Integer> quarters = new HashSet<>();
        for (var q : request.quarters()) {
            if (!quarters.add(q.number())) throw new IllegalArgumentException("쿼터 번호가 중복됩니다.");
            Map<String, Set<Integer>> slots = new HashMap<>(); Set<Long> players = new HashSet<>();
            for (var a : q.lineup()) {
                validateTeam(request.kind(), a.team());
                request.formation(a.team()).requireSlot(a.slot());
                if (a.entryOrder() < 0 || a.entryOrder() > 1) throw new IllegalArgumentException("출전 구분은 선발 또는 교체여야 합니다.");
                if (!slots.computeIfAbsent(a.team() + ":" + a.slot(), key -> new HashSet<>()).add(a.entryOrder())) throw new IllegalArgumentException(q.number() + "쿼터의 같은 팀 안의 같은 자리에는 선발 1명과 교체 1명만 기록할 수 있습니다.");
                if (!players.add(a.playerId())) throw new IllegalArgumentException(q.number() + "쿼터에 같은 선수를 중복 배치할 수 없습니다.");
                if (!attendees.getOrDefault(a.playerId(), Attendance.UNCONFIRMED).canPlay()) throw new IllegalArgumentException(q.number() + "쿼터: 실제 출석이 참석 또는 지각인 선수만 배치할 수 있습니다.");
            }
            if (slots.values().stream().anyMatch(orders -> !orders.contains(0))) throw new IllegalArgumentException(q.number() + "쿼터: 교체 선수를 입력하려면 같은 자리의 선발 선수도 필요합니다.");
            for (var team : MatchTeam.values()) {
                int goals = q.lineup().stream().filter(a -> a.team() == team).mapToInt(MatchRequest.Appearance::goals).sum();
                int assists = q.lineup().stream().filter(a -> a.team() == team).mapToInt(MatchRequest.Appearance::assists).sum();
                if (assists > goals) throw new IllegalArgumentException(q.number() + "쿼터 " + team + "팀의 도움 합계는 해당 팀 득점 합계를 넘을 수 없습니다.");
            }
        }
        if (!quarters.equals(Set.of(1, 2, 3, 4))) throw new IllegalArgumentException("1~4쿼터를 한 번씩 입력해 주세요.");
        validatePlan(request);
    }
    private static void validatePlan(MatchRequest request) {
        Set<Long> voters = new HashSet<>();
        request.participants().stream().filter(p -> p.vote() == Vote.ATTENDING).forEach(p -> voters.add(p.playerId()));
        Set<String> places = new HashSet<>(); Set<String> people = new HashSet<>();
        for (var a : request.plannedLineup()) {
            validateTeam(request.kind(), a.team());
            request.formation(a.team()).requireSlot(a.slot());
            if (a.quarterNumber() < 1 || a.quarterNumber() > 4 || a.entryOrder() < 0 || a.entryOrder() > 1 || a.slot() == null)
                throw new IllegalArgumentException("계획 스쿼드의 쿼터·자리·선발/교체를 확인해 주세요.");
            if (!voters.contains(a.playerId())) throw new IllegalArgumentException("계획 스쿼드에는 참석 예정으로 투표한 선수만 배치할 수 있습니다.");
            if (!places.add(a.quarterNumber() + ":" + a.team() + ":" + a.slot() + ":" + a.entryOrder())) throw new IllegalArgumentException("계획 스쿼드의 같은 자리에 선수를 중복 배치할 수 없습니다.");
            if (!people.add(a.quarterNumber() + ":" + a.playerId())) throw new IllegalArgumentException("계획 스쿼드의 같은 쿼터에 선수를 중복 배치할 수 없습니다.");
        }
        for (var a : request.plannedLineup()) if (a.entryOrder() == 1 && !places.contains(a.quarterNumber() + ":" + a.team() + ":" + a.slot() + ":0"))
            throw new IllegalArgumentException("계획 스쿼드의 교체 선수를 넣으려면 같은 자리의 선발이 필요합니다.");
    }
    private static void validateTeam(MatchKind kind, MatchTeam team) {
        if (kind == MatchKind.EXTERNAL && team != MatchTeam.A) throw new IllegalArgumentException("외부 경기는 우리 팀(A)만 배치할 수 있습니다.");
    }
    public Formation getFormationA() { return Formation.orDefault(formationA); }
    public Formation getFormationB() { return Formation.orDefault(formationB); }
    public MatchKind getKind() { return kind; }
    public RecordingStage getRecordingStage() { return recordingStage; }
    public Long getId() { return id; }
    public Long getTeamId() { return teamId; }
    MatchRecord assignToTeam(long teamId) {
        if (teamId < 1 || (this.teamId != null && this.teamId != teamId))
            throw new IllegalArgumentException("경기의 팀 소속을 변경할 수 없습니다.");
        this.teamId = teamId;
        return this;
    }
    public Long getVersion() { return version; }
    public LocalDate getPlayedOn() { return playedOn; }
    public LocalTime getKickoff() { return kickoff; }
    public Integer getScoreFor() { return scoreFor; }
    public Integer getScoreAgainst() { return scoreAgainst; }
    public String getVenue() { return venue; }
    public String getOpponent() { return opponent; }
    public String getNotes() { return notes; }
    public List<MatchParticipant> getParticipants() { return Collections.unmodifiableList(participants); }
    public List<MatchQuarter> getQuarters() { return Collections.unmodifiableList(quarters); }
    public List<MatchAppearance> getAppearances() { return Collections.unmodifiableList(appearances); }
    public List<MatchRequest.PlannedEntry> getPlannedLineup() { return plannedLineup.stream().map(PlannedLineup::response)
            .sorted(Comparator.comparingInt(MatchRequest.PlannedEntry::quarterNumber).thenComparing(MatchRequest.PlannedEntry::team).thenComparing(MatchRequest.PlannedEntry::slot).thenComparingInt(MatchRequest.PlannedEntry::entryOrder)).toList(); }
    public double creditedQuarters(long playerId) {
        return appearances.stream().filter(a -> a.getPlayerId() == playerId).mapToDouble(a ->
                appearances.stream().filter(other -> other.getQuarterNumber() == a.getQuarterNumber() && other.getTeam() == a.getTeam() && other.getSlot() == a.getSlot()).count() == 2 ? 0.5 : 1.0).sum();
    }
}
