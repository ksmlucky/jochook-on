import { useEffect, useRef, useState } from 'react'
import type { MatchRecord, MatchTeam, Quarter } from './api'
import { fetchMatch, playerLabel } from './api'
import { SessionExpiredError } from '../auth/api'
import { TeamBadge } from '../teams/TeamLogoManager'
import type { TeamDisplay } from '../../app/team'
import { quarterLabel } from './matchFormat'
import { formationFor, formationLabel, pitchRowsFor, slotLabels, slotGroup } from './formations'
import { PitchMarkings } from './PitchMarkings'
import { legacyQuarterTotals, reportScoreDifference, reportTimeline } from './reportTimeline'
import { RecordingStatus } from './RecordingStatus'
import { MatchCategoryBadge } from './MatchCategoryBadge'
import { matchTimeRange } from './time'
import { MatchResultImageShare } from './MatchResultImageShare'
import './squad-overview.css'
import './match-report.css'

export function MatchReport({ id, team, onClose, onEdit, onSessionExpired }: {
  id: number; team: TeamDisplay; onClose: () => void; onEdit?: () => void; onSessionExpired: () => void
}) {
  const [record, setRecord] = useState<MatchRecord | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const controller = new AbortController(); setRecord(null); setError('')
    fetchMatch(id, controller.signal).then(value => { if (!controller.signal.aborted) setRecord(value) }).catch(cause => {
      if (controller.signal.aborted) return
      if (cause instanceof SessionExpiredError) onSessionExpired()
      else setError('경기를 불러오지 못했어요. 다시 시도해 주세요.')
    })
    return () => controller.abort()
  }, [id, revision, onSessionExpired])
  useEffect(() => { if (record) heading.current?.focus({ preventScroll: true }) }, [record])
  const name = (id: number) => { const p = record?.participants.find(p => p.playerId === id); return p ? playerLabel(p) : '선수 확인 필요' }
  return <article className="match-report">
    <div className="report-toolbar"><button type="button" className="secondary-button" onClick={onClose}>← 목록</button>{onEdit && <button type="button" className="secondary-button" onClick={onEdit}>기록 수정</button>}</div>
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => setRevision(v => v + 1)}>다시 시도</button></div>}
    {!record && !error && <p role="status">경기를 불러오는 중이에요.</p>}
    {record && <>
      <header className="report-header"><div className="compact-match-meta"><time>{record.playedOn}</time><MatchCategoryBadge match={record} /><RecordingStatus stage={record.recordingStage} compact /></div>
        <h3 ref={heading} tabIndex={-1} className="sr-only">경기 결과</h3>
        <div className="report-scoreboard"><div><TeamBadge teamId={team.id} teamName={team.name} /><strong>{record.kind === 'INTERNAL' ? 'A팀' : team.name}</strong></div>
          <strong className="report-final-score">{record.scoreFor ?? '—'} : {record.scoreAgainst ?? '—'}</strong>
          <div><span className="report-opponent-badge" aria-hidden="true">{record.kind === 'INTERNAL' ? 'B' : (record.opponent || '?').slice(0, 1)}</span><strong>{record.kind === 'INTERNAL' ? 'B팀' : record.opponent || '상대 팀 미입력'}</strong></div></div>
        <p className="field-help">{matchTimeRange(record.kickoff, record.matchFormat)}{record.venue && ` · ${record.venue}`}{record.tournamentName && ` · ${record.tournamentName}`}</p>
        <div className="report-image-action"><MatchResultImageShare record={record} teamName={team.name} /></div>
      </header>
      <section aria-labelledby="report-timeline-heading"><h3 id="report-timeline-heading">득실점 타임라인</h3>
        {reportScoreDifference(record) && <p className="save-notice">최종 스코어와 구간별 득실점 합계가 달라요. 일부 골의 순서가 빠져 있을 수 있어 중간 스코어는 표시하지 않아요.</p>}
        {reportTimeline(record).map(({ quarter: q, known, entries }) => <section className="report-quarter-timeline" key={q.number} aria-label={quarterLabel(q.number, record.matchFormat)}>
          <h4>{quarterLabel(q.number, record.matchFormat)}{!known && <small>순서 미기록</small>}</h4>
          {known ? entries.length ? <ol className="report-events">{entries.map(({ event, side, score }, i) => <li key={i} data-side={side}>
            <span className="report-event-order">{i + 1}</span><div><strong>{event ? `${record.kind === 'INTERNAL' ? `${side}팀 · ` : ''}${name(event.scorerId)} 골` : '상대 팀 득점 · 실점'}</strong>
              {event?.assistId != null && <small>도움 · {name(event.assistId)}</small>}{event && event.type !== 'NORMAL' && <small>{event.type === 'FREE_KICK' ? '직접 프리킥' : '페널티킥'}</small>}</div>{score && <b>{score}</b>}
          </li>)}</ol> : <p className="field-help">득실점 없음</p> : <>
            <p className="field-help">득점과 실점의 앞뒤 순서는 기록되지 않았어요.</p>
            {Array.isArray(q.goalEvents) ? q.goalEvents.map((event, i) => <p className="report-legacy-goal" key={i}>{record.kind === 'INTERNAL' && `${event.team}팀 · `}{name(event.scorerId)} 골{event.assistId != null && ` · 도움 ${name(event.assistId)}`}{event.type === 'FREE_KICK' ? ' · 프리킥' : event.type === 'PENALTY' ? ' · 페널티킥' : ''}</p>) : <>
              <p className="field-help">선수별 합계 기록이에요. 골과 도움의 연결은 미기록이에요.</p>
              {legacyQuarterTotals(q).map(a => <p className="report-legacy-goal" key={a.playerId}>{record.kind === 'INTERNAL' && `${a.team}팀 · `}{name(a.playerId)} · {a.goals}골 · {a.assists}도움{(a.freeKickGoals ?? 0) > 0 && ` · 프리킥 ${a.freeKickGoals}골`}{(a.penaltyGoals ?? 0) > 0 && ` · 페널티킥 ${a.penaltyGoals}골`}</p>)}
            </>}
            {record.kind === 'EXTERNAL' && <p className="field-help">실점 {q.goalsAgainst == null ? '미입력' : `${q.goalsAgainst}골`}</p>}
          </>}
        </section>)}
      </section>
      <section aria-labelledby="report-squad-heading" className="report-squads"><h3 id="report-squad-heading">스쿼드·교체</h3>
        {record.quarters.map(q => <details className="report-period" key={q.number} open={q.number === 1}><summary>{quarterLabel(q.number, record.matchFormat)}<span>스쿼드·교체 보기</span></summary>
          {(record.kind === 'INTERNAL' ? ['A', 'B'] as const : ['A'] as const).map(side => <ReportPitch key={side} record={record} quarter={q} side={side} name={name} teamName={team.name} />)}
        </details>)}
      </section>
      {record.notes && <section className="report-comments"><h3>코멘트</h3><p>{record.notes}</p></section>}
    </>}
  </article>
}

function ReportPitch({ record, quarter, side, name, teamName }: { record: MatchRecord; quarter: Quarter; side: MatchTeam; name: (id: number) => string; teamName: string }) {
  const formation = formationFor(record, side)
  const actual = quarter.lineup.filter(a => a.team === side)
  const planned = record.plannedLineup.filter(a => a.team === side && a.quarterNumber === quarter.number)
  const entries = actual.length ? actual : planned
  return <div className="report-team-squad"><h4>{record.kind === 'INTERNAL' ? `${side}팀` : teamName} · {formationLabel(formation)}{!actual.length && !!planned.length && ' · 계획'}</h4>
    {!entries.length ? <p className="field-help">등록된 스쿼드가 없어요.</p> : <>
      <div className="tactics-pitch squad-overview-pitch report-pitch" data-formation={formation} aria-label={`${side}팀 포메이션`}><PitchMarkings />
        {pitchRowsFor(formation).flat().map(slot => { const starter = entries.find(a => a.slot === slot && a.entryOrder === 0); const sub = entries.find(a => a.slot === slot && a.entryOrder === 1); return <div key={slot} data-position={slot} className={`squad-overview-slot position-${slotGroup(slot)}`}><div className="squad-overview-card"><span className="squad-overview-position">{slotLabels[slot]}</span><strong className="squad-overview-name">{starter ? name(starter.playerId) : '미배치'}</strong>{sub && <span className="squad-overview-swap">↳ {name(sub.playerId)}</span>}</div></div> })}
      </div>
      <ul className="report-substitutions">{entries.filter(a => a.entryOrder === 1).map(sub => { const starter = entries.find(a => a.slot === sub.slot && a.entryOrder === 0); return <li key={sub.playerId}><span>{slotLabels[sub.slot]}</span><span>{starter ? name(starter.playerId) : '선발 미등록'} <span aria-label="교체 투입">→</span> <strong>{name(sub.playerId)}</strong></span></li> })}</ul>
      {!entries.some(a => a.entryOrder === 1) && <p className="field-help">교체 기록 없음</p>}
      <details className="report-roster"><summary>선수 명단 · 전체 이름 보기</summary><ul>
        {pitchRowsFor(formation).flat().map(slot => {
          const starter = entries.find(a => a.slot === slot && a.entryOrder === 0)
          const sub = entries.find(a => a.slot === slot && a.entryOrder === 1)
          return <li key={slot}><strong>{slotLabels[slot]}</strong><span>{starter ? name(starter.playerId) : '미배치'}{sub && <small>교체 · {name(sub.playerId)}</small>}</span></li>
        })}
      </ul></details>
    </>}
  </div>
}
