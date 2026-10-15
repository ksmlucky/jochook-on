import { useId } from 'react'
import type { MatchDraft, Participant } from './api'
import { playerLabel } from './api'
import { slotLabels } from './formations'
import { analyzeCompletion } from './completionReview'
import type { CompletionReviewTarget } from './completionReview'
import './completion-review.css'
import { matchPeriodSummary, quarterLabel } from './matchFormat'

type Props = {
  draft: MatchDraft
  onNavigate: (target: CompletionReviewTarget) => void
  disabled?: boolean
}

function ReviewPlayers({ players, step, onNavigate, disabled }: {
  players: Participant[]; step: 0 | 2; onNavigate: Props['onNavigate']; disabled?: boolean
}) {
  return <details className="completion-review-details">
    <summary>선수 {players.length}명 보기</summary>
    <ul className="completion-review-players">{players.map(player => <li key={player.playerId}>
      <button type="button" disabled={disabled} onClick={() => onNavigate({ step, playerId: player.playerId, ...(step === 2 ? { quarter: 1 } : {}) })}>
        <span>{playerLabel(player)}</span><span className="completion-review-link">{step === 0 ? '출석 확인' : '출전 확인'} <span aria-hidden="true">→</span></span>
      </button>
    </li>)}</ul>
  </details>
}

export function CompletionReview({ draft, onNavigate, disabled = false }: Props) {
  const headingId = useId()
  const review = analyzeCompletion(draft)
  const missingQuarters = review.quarters.filter(quarter => quarter.missingSlots.length > 0)
  const firstMissing = missingQuarters[0]
  const internal = draft.kind === 'INTERNAL'
  const hasDifference = review.scores.some(score => score.status === 'differs')
  const zeroDraw = draft.scoreFor === 0 && draft.scoreAgainst === 0
  return <section className="completion-review" aria-labelledby={headingId}>
    <div className="completion-review-heading"><h5 id={headingId}>완료 전 확인</h5><span>현재 입력 기준</span></div>
    <p className="completion-review-intro">출석과 실제 기록을 한 번 더 확인해 주세요. 빈 배치·미입력 스코어만으로 완료를 막지는 않아요.</p>
    <div className="completion-review-grid">
      <section className="completion-review-item">
        <div className="completion-review-item-heading"><h6>투표·실제 출석</h6>
          <button type="button" className="completion-review-jump" disabled={disabled} onClick={() => onNavigate({ step: 0 })}>01 출석 확인 <span aria-hidden="true">→</span></button>
        </div>
        <p>{review.unconfirmedAttendees.length ? <>참석 예정자 중 <strong>{review.unconfirmedAttendees.length}명</strong>의 실제 출석이 미확인이에요.</> : '참석 예정자 중 실제 출석이 미확인인 선수는 없어요.'}</p>
        {review.unconfirmedAttendees.length > 0 && <ReviewPlayers players={review.unconfirmedAttendees} step={0} onNavigate={onNavigate} disabled={disabled} />}
      </section>

      <section className="completion-review-item">
        <div className="completion-review-item-heading"><h6>쿼터별 선발 배치</h6>
          <button type="button" className="completion-review-jump" disabled={disabled} onClick={() => onNavigate({ step: 2, quarter: firstMissing?.quarter ?? 1, team: firstMissing?.team ?? 'A' })}>03 배치 확인 <span aria-hidden="true">→</span></button>
        </div>
        <p>{missingQuarters.length ? <><strong>{missingQuarters.length}개</strong>의 {internal ? '쿼터·팀' : '쿼터'}에 빈 선발 자리가 있어요.</> : `${internal ? '양 팀 모두 ' : ''}${matchPeriodSummary(draft.matchFormat)}에 선발 11명이 배치돼 있어요.`}</p>
        <details className="completion-review-details"><summary>쿼터별 인원·빈 자리 보기</summary>
          <ul className="completion-review-quarters">{review.quarters.map(quarter => <li key={`${quarter.quarter}-${quarter.team}`}>
            <button type="button" disabled={disabled} onClick={() => onNavigate({ step: 2, quarter: quarter.quarter, team: quarter.team })}>
              <span className="completion-review-quarter-title"><strong>{quarterLabel(quarter.quarter, draft.matchFormat)}{internal ? ` ${quarter.team}팀` : ''}</strong><span>선발 {quarter.starterCount}/{quarter.requiredCount}</span></span>
              <span className="completion-review-empty-slots">{quarter.missingSlots.length ? `빈 자리 · ${quarter.missingSlots.map(slot => slotLabels[slot]).join(' · ')}` : '빈 자리 없음'}</span>
            </button>
          </li>)}</ul>
        </details>
        <p className="completion-review-hint">교체 선수는 선발 인원에 포함하지 않아요. 일부만 기록한 경기라면 그대로 둘 수 있어요.</p>
      </section>

      <section className="completion-review-item">
        <div className="completion-review-item-heading"><h6>참석자의 출전 기록</h6>
          <button type="button" className="completion-review-jump" disabled={disabled} onClick={() => onNavigate({ step: 2, quarter: 1 })}>03 출전 확인 <span aria-hidden="true">→</span></button>
        </div>
        <p>{review.attendeesWithoutAppearance.length ? <>참석·지각한 선수 중 <strong>{review.attendeesWithoutAppearance.length}명</strong>은 실제 출전 기록이 없어요.</> : '참석·지각한 선수 중 실제 출전 기록이 없는 선수는 없어요.'}</p>
        {review.attendeesWithoutAppearance.length > 0 && <ReviewPlayers players={review.attendeesWithoutAppearance} step={2} onNavigate={onNavigate} disabled={disabled} />}
        <p className="completion-review-hint">참석만 하고 뛰지 않은 경우는 그대로 두면 돼요. 02 계획은 실제 출전으로 세지 않아요.</p>
      </section>

      <section className="completion-review-item">
        <div className="completion-review-item-heading"><h6>스코어·선수 득점</h6>
          <button type="button" className="completion-review-jump" disabled={disabled} onClick={() => onNavigate({ step: 3 })}>04 스코어 확인 <span aria-hidden="true">→</span></button>
        </div>
        {review.scoreInput === 'unrecorded' ? <p>최종 스코어가 비어 있어요. 아직 모른다면 비워 두고 완료할 수 있어요.</p>
          : review.scoreInput === 'partial' ? <p>스코어가 한쪽만 입력돼 있어요. 양쪽 모두 입력하거나 모두 비워 주세요.</p>
            : hasDifference ? <p>입력한 스코어와 선수 득점 합계가 달라요.</p>
              : <p>입력한 스코어와 선수 득점 합계가 같아요.{zeroDraw && ' 0:0도 정상적인 최종 스코어예요.'}</p>}
        <ul className="completion-review-scores">{review.scores.map(score => <li key={score.team}>
          <strong>{internal ? `${score.team}팀` : '우리 팀'}</strong><span>스코어 {score.score === null ? '미입력' : `${score.score}골`} <span aria-hidden="true">/</span> 선수 합계 {score.playerGoals}골</span>
        </li>)}</ul>
        {hasDifference && <p className="completion-review-hint">득점자 미입력·상대 자책골 등으로 다를 수 있어요. 실제 결과를 확인한 뒤 그대로 저장할 수도 있어요.</p>}
      </section>
    </div>
  </section>
}
