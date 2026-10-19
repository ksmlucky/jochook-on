package com.jochookon.match;

import static org.assertj.core.api.Assertions.*;
import static com.jochookon.match.MatchTestData.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class QuarterConcededTest {
    private MatchRequest requestWith(Integer value, Boolean specified) {
        var base = request(null, List.of(), List.of());
        var quarters = new ArrayList<>(base.quarters());
        quarters.set(0, new MatchRequest.Quarter(1, List.of(), List.of(), value, specified));
        return new MatchRequest(base.playedOn(), base.kickoff(), base.venue(), base.opponent(), base.notes(), null,
                base.participants(), quarters, List.of(), null, null, MatchKind.EXTERNAL);
    }
    @Test void nullZeroAndPositiveArePreservedThroughEventsAndResponse() {
        for (Integer value : Arrays.asList(null, 0, 3)) {
            var match = MatchRecord.create(requestWith(value, true));
            assertThat(match.getQuarters().getFirst().getGoalsAgainst()).isEqualTo(value);
            assertThat(MatchResponse.from(match, Map.of()).quarters().getFirst().goalsAgainst()).isEqualTo(value);
        }
    }
    @Test void oldClientsPreserveConcededAndExplicitNullClearsIt() {
        var match = MatchRecord.create(requestWith(2, true));
        match.replace(requestWith(null, null));
        assertThat(match.getQuarters().getFirst().getGoalsAgainst()).isEqualTo(2);
        match.replace(requestWith(null, true));
        assertThat(match.getQuarters().getFirst().getGoalsAgainst()).isNull();
    }
    @Test void invalidValuesAreRejectedAndFingerprintDistinguishesClearAndOmit() {
        for (int value : List.of(-1, 100)) assertThatThrownBy(() -> MatchRecord.create(requestWith(value, true))).hasMessageContaining("실점");
        var json = JsonMapper.builder().build();
        var hashes = List.of(requestWith(null, null), requestWith(null, true), requestWith(0, true), requestWith(1, true))
                .stream().map(r -> MatchSaveFingerprint.of(r, json)).toList();
        assertThat(new HashSet<>(hashes)).hasSize(4);
    }
}
