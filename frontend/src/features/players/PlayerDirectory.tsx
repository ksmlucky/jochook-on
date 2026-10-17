import { positionLabels, preferredPositionGroup } from './api'
import type { Player, PlayerPage } from './api'
import { ageBand, ageDescription, seoulYear, yearAge } from './age'
import './player-directory.css'

export function PlayerDirectory({ data, view, onPageChange, onEdit, filtered = false, onResetFilters }: {
  data: PlayerPage
  view: 'cards' | 'table'
  onPageChange: (page: number) => void
  onEdit?: (player: Player) => void
  filtered?: boolean
  onResetFilters?: () => void
}) {
  if (data.items.length === 0) {
    return <div className="empty-state">
      <div className="empty-number" aria-hidden="true">—</div>
      <h3>{filtered ? '조건에 맞는 선수가 없어요' : '아직 등록된 선수가 없어요'}</h3>
      <p>{filtered ? '조건을 바꾸거나 필터를 초기화해 주세요.' : '운영진이 선수를 등록하면 이곳에서 볼 수 있어요.'}</p>
      {filtered && onResetFilters && <button className="secondary-button" onClick={onResetFilters}>필터 초기화</button>}
      {data.page > 0 && <button className="secondary-button" onClick={() => onPageChange(0)}>첫 페이지로</button>}
    </div>
  }

  return <>
    <div className="roster-summary"><p className="field-help">{filtered ? '필터 조건에 맞는 활동 선수' : '활동 중인 선수'}</p>
      <span>{data.page * data.size + 1}–{data.page * data.size + data.items.length} / {data.totalElements}명</span></div>
    <div className="position-legend" aria-label="포지션 색상 안내">{(['FW', 'MF', 'DF', 'GK', 'UN'] as const).map(code => <span className={`position-badge position-${code}`} key={code}>{positionLabels[code]}</span>)}</div>
    {view === 'table' ? <div className="roster-table-scroll" role="region" aria-label="선수 명단 표 (가로 스크롤 가능)" tabIndex={0}>
      <table className="roster-table compact-roster-table"><caption className="sr-only">활동 중인 선수 · {data.page + 1}페이지</caption>
        <colgroup><col className="col-shirt" /><col className="col-player" /><col className="col-age" /><col className="col-preferences" /><col className="col-joined" />{onEdit && <col className="col-edit" />}</colgroup>
        <thead><tr><th scope="col" aria-label="등번호">번호</th><th scope="col">선수</th><th scope="col">나이</th><th scope="col">선호 포지션</th><th scope="col">가입일</th>{onEdit && <th scope="col">관리</th>}</tr></thead>
        <tbody>{data.items.map(player => <tr key={player.id}>
          <td className="table-shirt">{player.shirtNumber ?? '—'}</td>
          <th scope="row" className="table-player">{player.name}<small>{player.clubRole ?? '정회원'}</small></th>
          <td>{yearAge(player.birthYear, seoulYear()) === null ? '미확인' : `${yearAge(player.birthYear, seoulYear())}세 · ${ageBand(player.birthYear, seoulYear())}`}<small>{player.birthYear ? `${player.birthYear}년생` : '생년 미확인'}</small></td>
          <td><span className={`position-badge position-${preferredPositionGroup(player.firstChoice)}`} aria-label={`1지망 ${player.firstChoice ?? '미입력'}`}><span className="preference-rank">1</span> {player.firstChoice ?? '미입력'}</span>
            <small className="table-other-preferences">2 {player.secondChoice ?? '—'} <span aria-hidden="true"> / </span>3 {player.thirdChoice ?? '—'}</small></td>
          <td>{player.joinedOn ?? '미등록'}</td>{onEdit && <td><button className="edit-button" onClick={() => onEdit(player)} aria-label={`${player.name} 수정`}>수정</button></td>}
        </tr>)}</tbody>
      </table>
    </div> : <ul className="player-grid compact-roster" aria-label="활동 중인 선수">
      {data.items.map(player => <li className={`player-card position-${preferredPositionGroup(player.firstChoice)}`} key={player.id}>
        <span className="shirt-number" aria-label={`등번호 ${player.shirtNumber ?? '미등록'}`}>
          {player.shirtNumber ?? '—'}
        </span>
        <div className="player-info"><h3>{player.name}</h3>
          <p>{ageBand(player.birthYear, seoulYear())} · {player.clubRole ?? '정회원'}</p>
        </div>
        <div className="player-actions"><span className="position-code position-badge" aria-label={`1지망 ${player.firstChoice ?? '미입력'}`}>{player.firstChoice ?? '?'}</span>
          {onEdit && <button className="edit-button" onClick={() => onEdit(player)} aria-label={`${player.name} 수정`}>수정</button>}
        </div>
        <details className="player-card-details"><summary aria-label={`${player.name} 상세 정보`}>상세 정보</summary>
          <p>{ageDescription(player.birthYear, seoulYear())}</p>
          <p>{player.firstChoice ? [player.firstChoice, player.secondChoice, player.thirdChoice].filter(Boolean).map((p, i) => `${i + 1}지망 ${p}`).join(' · ') : '선호 포지션 미입력'}</p>
          <p>{player.joinedOn ? <><time dateTime={player.joinedOn}>{player.joinedOn}</time> 가입</> : '가입일 미등록'}</p>
        </details>
      </li>)}
    </ul>}
    {data.totalPages > 1 && <nav className="pagination" aria-label="선수 목록 페이지">
      <button className="secondary-button" disabled={data.page === 0} onClick={() => onPageChange(data.page - 1)}>이전</button>
      <span>{data.page + 1} / {data.totalPages}</span>
      <button className="secondary-button" disabled={data.page + 1 >= data.totalPages} onClick={() => onPageChange(data.page + 1)}>다음</button>
    </nav>}
  </>
}
