import { useEffect, useRef, useState } from 'react'
import { SessionExpiredError } from '../auth/api'
import { playerLabel, suggestLineup } from './api'
import type { LineupSuggestion, MatchDraft, PlannedEntry } from './api'
import type { Player } from '../players/api'
import { plannedShare } from './plan'
import { formationFor, formationLabel, slotPosition } from './formations'
import { generateMatchPlan } from './automaticPlan'
import { plannedTeamPlayers, unassignedAttendees } from './internalTeams'
import { matchPeriodSummary, normalizeMatchFormat, quarterLabel, quarterNumbers } from './matchFormat'

export function AutomaticLineup({ draft, players, matchId, disabled, onBusy, onApply, onSessionExpired }: {
  draft: MatchDraft; players: Player[]; matchId: number | null; disabled: boolean; onBusy: (busy: boolean) => void
  onApply: (entries: PlannedEntry[]) => void; onSessionExpired: () => void
}) {
  const [result, setResult] = useState<LineupSuggestion | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const request = useRef<AbortController | null>(null)
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const selected = draft.participants.filter(p => p.vote === 'ATTENDING')
  const internal = draft.kind === 'INTERNAL'
  const incompleteTeams = internal && (unassignedAttendees(draft.participants).length > 0 || !plannedTeamPlayers(draft.participants, 'A').length || !plannedTeamPlayers(draft.participants, 'B').length)
  const formation = formationFor(draft)
  const periods = quarterNumbers(draft.matchFormat)
  const periodSummary = matchPeriodSummary(draft.matchFormat)
  const twoHalves = normalizeMatchFormat(draft.matchFormat) === 'TWO_HALVES_30'
  const selectionKey = `${matchId}:${draft.playedOn}:${draft.kind}:${draft.matchFormat}:${formation}:${formationFor(draft, 'B')}:${selected.map(p => `${p.playerId}-${p.plannedTeam ?? ''}`).sort().join(',')}`
  const latestSelection = useRef(selectionKey); latestSelection.current = selectionKey
  useEffect(() => { setResult(null); setConfirm(false); setError('') }, [selectionKey])
  useEffect(() => () => request.current?.abort(), [])
  async function generate(confirmed = false) {
    if (disabled || request.current || !selected.length || incompleteTeams) return
    if (!draft.playedOn || !/^\d{4}-\d{2}-\d{2}$/.test(draft.playedOn)) { setError('경기 날짜를 먼저 입력해 주세요.'); return }
    if (draft.plannedLineup.length && !confirmed) { setConfirm(true); return }
    const controller = new AbortController(); request.current = controller
    setPending(true); onBusy(true); setError(''); setConfirm(false)
    try {
      const seed = crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff
      const suggestion = await generateMatchPlan(draft, matchId, seed, controller.signal, suggestLineup)
      if (controller.signal.aborted || latestSelection.current !== selectionKey) return
      onApply(suggestion.plannedLineup); setResult(suggestion)
      requestAnimationFrame(() => { resultHeading.current?.focus({ preventScroll: true }); resultHeading.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) })
    } catch (cause) {
      if (controller.signal.aborted) return
      if (cause instanceof SessionExpiredError) { onSessionExpired(); return }
      setError(cause instanceof Error ? cause.message : '자동 편성을 계산하지 못했습니다. 다시 시도해 주세요.')
    } finally {
      request.current = null
      if (!controller.signal.aborted) { setPending(false); onBusy(false) }
    }
  }
  return <section className="automatic-lineup" aria-labelledby="auto-title" aria-busy={pending}>
    <div className="match-block-title"><h4 id="auto-title">참석 명단 확인 · 자동 편성</h4><span>참석 예정 {selected.length}명</span></div>
    <p>{internal ? `01에서 나눈 팀별로 A팀 ${formationLabel(formation)} · B팀 ${formationLabel(formationFor(draft, 'B'))} 계획을 만들어요. 팀을 섞지 않고 각각 계산해요.` : `참석 예정 선수로 ${formationLabel(formation)} · ${periodSummary} 계획을 만들어요.`} 모두 {periods.length}쿼터에 참여할 수 있을 때 사용해 주세요.</p>
    {incompleteTeams && <p className="field-help">01에서 참석 예정 선수를 A·B팀에 모두 배정한 뒤 자동 편성해 주세요.</p>}
    <details className="auto-policy"><summary>자동 편성 기준 보기</summary><ul className="auto-rules">
      <li>1~3지망에 GK가 있으면 GK 그룹으로 배정 · 한 명이면 {periods.length}쿼터 전담</li>
      <li>두 쿼터 연속 휴식 방지 · {twoHalves ? '전반 교체 최소화, 후반 교체 우선' : '1~3쿼터 교체 최소화, 4쿼터 교체 우선'}</li>
      <li>그룹 안에서 출전량 차이 최대 1쿼터 · 더 뛸 인원은 과거 출석률 우선</li>
      <li>선호 점수 1지망 100 / 2지망 60 / 3지망 30</li>
      <li>정확한 선호 포지션을 우선하고, 인접 포지션은 대체 점수 20 / 12 / 6 중 해당하는 가장 높은 지망의 점수 하나를 적용하며 비선호 배치로 표시</li>
      <li>인접 포지션: LW↔LM · RW↔RM · CM↔CAM · LB↔LWB · LM↔LWB · RB↔RWB · RM↔RWB</li>
    </ul><p className="field-help">출석률 = 해당 경기일 이전 참석·지각 ÷ 참석·지각·불참 기록. 미확인과 현재 경기는 제외합니다. 기록 없음은 우선순위 계산에서 0%와 같으며 동률은 계산마다 추첨합니다.</p></details>
    <button type="button" className="primary-button" disabled={disabled || !selected.length || incompleteTeams} onClick={() => void generate()}>{pending ? `${periodSummary} 편성 계산 중…` : `${internal ? 'A·B팀 ' : ''}${periodSummary} 자동 편성`}</button>
    <p className="field-help">편성 후 수정할 수 있어요. 확인을 마치면 계획을 저장해 주세요.</p>
    {confirm && <div className="conflict-notice" role="alert"><p>현재 {periodSummary} 계획을 새 자동 편성으로 교체할까요? 실제 출석·득점·도움은 그대로 유지됩니다.</p><div className="registration-actions">
      <button type="button" className="primary-button" disabled={disabled} onClick={() => void generate(true)}>계획 교체하고 자동 편성</button>
      <button type="button" className="secondary-button" disabled={disabled} onClick={() => setConfirm(false)}>기존 계획 유지</button>
    </div></div>}
    {error && <p className="form-error" role="alert">{error} 기존 계획은 유지했습니다.</p>}
    {result && <div className="auto-result">
      <h4 ref={resultHeading} tabIndex={-1}>{periodSummary} 계획을 만들었어요</h4>
      <p className="field-help">아래 배치와 출전량을 확인한 뒤 저장해 주세요. 직접 수정하면 출전 배분도 달라질 수 있어요.</p>
      {!!result.warnings.length && <ul className="import-warning">{result.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
      <div className="auto-quarter-summary">{periods.map(q => <span key={q}><strong>{quarterLabel(q, draft.matchFormat)}</strong> 선발 {draft.plannedLineup.filter(e => e.quarterNumber === q && e.entryOrder === 0).length}명 · 교체 {draft.plannedLineup.filter(e => e.quarterNumber === q && e.entryOrder === 1).length}명</span>)}</div>
      <details><summary>선수별 출석률 · 출전 배분 펼치기</summary><div className="match-table-scroll"><table className="match-table"><thead><tr><th>선수</th><th>그룹</th><th>과거 출석률</th><th>예정 출전</th><th>쉬는 쿼터</th><th>비선호 배치</th></tr></thead><tbody>
        {[...selected].sort((a, b) => (a.shirtNumber ?? 100) - (b.shirtNumber ?? 100)).map(p => {
          const a = result.allocations.find(a => a.playerId === p.playerId)!
          if (!a) return null
          const entries = draft.plannedLineup.filter(e => e.playerId === p.playerId)
          const quarters = entries.reduce((sum, e) => sum + plannedShare(draft.plannedLineup, e), 0)
          const rest = periods.filter(q => !entries.some(e => e.quarterNumber === q))
          const player = players.find(player => player.id === p.playerId)
          const preferences: (string | null | undefined)[] = [player?.firstChoice, player?.secondChoice, player?.thirdChoice]
          const nonPreferred = entries.filter(e => !preferences.includes(slotPosition(e.slot)))
          return <tr key={p.playerId}><th scope="row">{internal && `${p.plannedTeam}팀 · `}{playerLabel(p)}</th><td>{a.group === 'UNKNOWN' ? '포지션 확인 필요' : a.group === 'GK' ? 'GK' : '필드'}</td><td>{a.recorded ? `${Math.round(a.attended / a.recorded * 100)}% (${a.attended}/${a.recorded})` : '기록 없음'}</td><td><strong>{quarters}쿼터</strong></td><td>{rest.length ? rest.map(q => `${q}Q`).join(' · ') : '없음'}{rest.some(q => rest.includes(q + 1)) && <small>연속 휴식 확인 필요</small>}</td><td>{nonPreferred.length ? nonPreferred.map(e => `${e.quarterNumber}Q ${e.slot}`).join(' · ') : '없음'}</td></tr>
        })}
      </tbody></table></div></details>
    </div>}
  </section>
}
