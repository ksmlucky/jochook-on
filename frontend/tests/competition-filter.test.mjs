import test from 'node:test'
import assert from 'node:assert/strict'
import { appendCompetitionQuery, competitionFilterValue, competitionSelection } from '../src/features/tournaments/competitionScope.ts'
import { playerMatchesQuery, statsQuery, statsScopeLabel, withStatsCompetition, withStatsKind } from '../src/features/stats/stats.ts'

const base = Object.freeze({ year: 2026, kind: 'EXTERNAL', recordScope: 'COMPLETED', includeGuests: false, competitionScope: 'ALL' })

test('generic competition choices clear an earlier tournament while a specific choice keeps its identity and label', () => {
  for (const scope of ['ALL', 'LEAGUE', 'TOURNAMENT']) {
    assert.deepEqual(competitionSelection(scope, '이전 대회'), { competitionScope: scope, tournamentId: null, tournamentName: null })
    assert.equal(competitionFilterValue(scope, null), scope)
  }
  assert.deepEqual(competitionSelection('tournament:42', '가상 K7'), { competitionScope: 'TOURNAMENT', tournamentId: 42, tournamentName: '가상 K7' })
  assert.equal(competitionFilterValue('ALL', 42), 'tournament:42', 'legacy selection stays selected even before its list loads')
  assert.equal(competitionSelection('tournament:42').tournamentId, 42, 'missing list details cannot clear a selected tournament')
  for (const value of ['undefined', 'tournament:0', 'tournament:-1', 'tournament:1.5', 'tournament:9007199254740992']) assert.throws(() => competitionSelection(value), RangeError)
})

test('competition query keeps the old ALL request and rejects contradictory league plus tournament filters', () => {
  const empty = new URLSearchParams('page=0'); appendCompetitionQuery(empty, { competitionScope: 'ALL' })
  assert.equal(empty.toString(), 'page=0')
  for (const scope of ['LEAGUE', 'TOURNAMENT']) {
    const query = new URLSearchParams(); appendCompetitionQuery(query, { competitionScope: scope })
    assert.equal(query.toString(), `competitionScope=${scope}`)
  }
  assert.throws(() => appendCompetitionQuery(new URLSearchParams(), { competitionScope: 'LEAGUE', tournamentId: 42 }), RangeError)
  assert.throws(() => appendCompetitionQuery(new URLSearchParams(), { tournamentId: 0 }), RangeError)
})

test('league includes internal games while tournament selection only clears a conflicting internal-only type', () => {
  const internal = { ...base, kind: 'INTERNAL', year: 2025, includeGuests: true, recordScope: 'ALL' }
  const league = withStatsCompetition(internal, competitionSelection('LEAGUE'))
  assert.equal(league.kind, 'INTERNAL')
  assert.equal(withStatsKind(league, 'ALL').competitionScope, 'LEAGUE')
  assert.equal(withStatsCompetition({ ...base, kind: 'ALL' }, competitionSelection('LEAGUE')).kind, 'ALL')
  for (const choice of ['TOURNAMENT', 'tournament:42']) {
    const selected = withStatsCompetition(internal, competitionSelection(choice, '가상 K7'))
    assert.equal(selected.kind, 'ALL'); assert.equal(selected.year, 2025); assert.equal(selected.includeGuests, true); assert.equal(selected.recordScope, 'ALL')
    assert.deepEqual(withStatsKind(selected, 'INTERNAL'), { ...internal, competitionScope: 'ALL', tournamentId: null, tournamentName: null })
    assert.deepEqual(withStatsKind(selected, 'ALL'), selected)
    assert.deepEqual(withStatsKind(selected, 'EXTERNAL'), { ...selected, kind: 'EXTERNAL' })
    assert.equal(withStatsCompetition(selected, competitionSelection('LEAGUE')).kind, 'ALL', 'returning to league must include internal games again')
  }
  assert.equal(withStatsCompetition(internal, competitionSelection('ALL')).kind, 'INTERNAL', 'clearing competition cannot silently broaden the match kind')
  assert.equal(internal.kind, 'INTERNAL')
})

test('season and player pages use the identical competition filter without changing the snapshot', () => {
  for (const choice of ['ALL', 'LEAGUE', 'TOURNAMENT', 'tournament:42']) {
    const selected = Object.freeze(withStatsCompetition(base, competitionSelection(choice, '가상 K7')))
    const query = new URLSearchParams(statsQuery(selected)), detail = new URLSearchParams(playerMatchesQuery(selected, 2))
    assert.equal(detail.get('page'), '2'); detail.delete('page'); assert.equal(detail.toString(), query.toString())
    assert.equal(query.get('competitionScope'), choice === 'ALL' ? null : choice === 'LEAGUE' ? 'LEAGUE' : 'TOURNAMENT')
    assert.equal(query.get('tournamentId'), choice === 'tournament:42' ? '42' : null)
  }
  assert.equal(new URLSearchParams(statsQuery({ ...base, kind: 'INTERNAL', competitionScope: 'LEAGUE' })).get('kind'), 'INTERNAL')
  assert.throws(() => statsQuery({ ...base, kind: 'INTERNAL', competitionScope: 'TOURNAMENT' }), RangeError)
  assert.throws(() => statsQuery({ ...base, competitionScope: 'LEAGUE', tournamentId: 42 }), RangeError)
})

test('season scope distinguishes combined external, league-only, all tournaments, and one named tournament', () => {
  assert.match(statsScopeLabel(base), /리그 \+ 대회 합산/)
  assert.match(statsScopeLabel({ ...base, competitionScope: 'LEAGUE' }), /리그만/)
  assert.match(statsScopeLabel({ ...base, competitionScope: 'TOURNAMENT' }), /대회만/)
  assert.match(statsScopeLabel({ ...base, competitionScope: 'TOURNAMENT', tournamentId: 42, tournamentName: '가상 K7' }), /대회: 가상 K7/)
  assert.match(statsScopeLabel({ ...base, kind: 'INTERNAL' }), /자체전만.*리그/)
  assert.match(statsScopeLabel({ ...base, kind: 'ALL', competitionScope: 'LEAGUE' }), /자체전 포함.*리그만/)
  assert.doesNotMatch(statsScopeLabel({ ...base, kind: 'ALL', competitionScope: 'TOURNAMENT' }), /자체전 포함/)
})
