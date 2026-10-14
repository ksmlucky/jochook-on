import { positionLabels, preferredPositionGroup } from './api'
import type { Player, PlayerPage } from './api'
import { ageBand, ageDescription, seoulYear, yearAge } from './age'

export function PlayerDirectory({ data, view, onPageChange, onEdit }: {
  data: PlayerPage
  view: 'cards' | 'table'
  onPageChange: (page: number) => void
  onEdit?: (player: Player) => void
}) {
  if (data.items.length === 0) {
    return <div className="empty-state">
      <div className="empty-number" aria-hidden="true">—</div>
      <h3>우리 팀의 첫 기록을 기다리고 있어요</h3>
      <p>선수 정보가 등록되면 이곳에서 함께 볼 수 있습니다.</p>
      {data.page > 0 && <button className="secondary-button" onClick={() => onPageChange(0)}>첫 페이지로</button>}
    </div>
  }

  return <>
    <div className="roster-summary"><p className="field-help">{seoulYear()}년 기준 · 생일과 관계없이 기준 연도 − 생년으로 나이와 연령대를 계산합니다.</p>
      <span>{data.page * data.size + 1}–{data.page * data.size + data.items.length} / {data.totalElements}명</span></div>
    <div className="position-legend" aria-label="포지션 색상 안내">{(['FW', 'MF', 'DF', 'GK', 'UN'] as const).map(code => <span className={`position-badge position-${code}`} key={code}>{positionLabels[code]}</span>)}</div>
    {view === 'table' ? <div className="roster-table-scroll" role="region" aria-label="선수 명단 표 (가로 스크롤 가능)" tabIndex={0}>
      <table className="roster-table"><caption className="sr-only">활동 중인 선수 · {data.page + 1}페이지</caption>
        <thead><tr>{['등번호', '이름', '직책', '생년', '나이·연령대', '1지망', '2지망', '3지망', '가입일', ...(onEdit ? ['관리'] : [])].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{data.items.map(player => <tr key={player.id}>
          <td className="table-shirt">{player.shirtNumber ?? '—'}</td><th scope="row">{player.name}</th><td>{player.clubRole ?? '정회원'}</td>
          <td>{player.birthYear ?? '미확인'}</td><td>{yearAge(player.birthYear, seoulYear()) === null ? '미확인' : `${yearAge(player.birthYear, seoulYear())}세 · ${ageBand(player.birthYear, seoulYear())}`}</td>
          <td><span className={`position-badge position-${preferredPositionGroup(player.firstChoice)}`}>{player.firstChoice ?? '미입력'}</span></td>
          <td>{player.secondChoice ?? '—'}</td><td>{player.thirdChoice ?? '—'}</td>
          <td>{player.joinedOn ?? '미등록'}</td>{onEdit && <td><button className="edit-button" onClick={() => onEdit(player)} aria-label={`${player.name} 수정`}>수정</button></td>}
        </tr>)}</tbody>
      </table>
    </div> : <ul className="player-grid" aria-label="활동 중인 선수">
      {data.items.map(player => <li className={`player-card position-${preferredPositionGroup(player.firstChoice)}`} key={player.id}>
        <span className="shirt-number" aria-label={`등번호 ${player.shirtNumber ?? '미등록'}`}>
          {player.shirtNumber ?? '—'}
        </span>
        <div className="player-info"><h3>{player.name}</h3><p>{positionLabels[preferredPositionGroup(player.firstChoice)]}</p>
          <p className="player-age">{ageDescription(player.birthYear, seoulYear())}</p>
          {player.clubRole && <p className="player-club-role">{player.clubRole}</p>}
          {player.joinedOn && <p><time dateTime={player.joinedOn}>{player.joinedOn}</time> 가입</p>}
          <p className="player-preferences">{player.firstChoice ? [player.firstChoice, player.secondChoice, player.thirdChoice].filter(Boolean).map((p, i) => `${i + 1}지망 ${p}`).join(' · ') : '선호 포지션 미입력'}</p>
        </div>
        <div className="player-actions"><span className="position-code position-badge" aria-label={`1지망 ${player.firstChoice ?? '미입력'}`}>{player.firstChoice ?? '?'}</span>
          {onEdit && <button className="edit-button" onClick={() => onEdit(player)} aria-label={`${player.name} 수정`}>수정</button>}
        </div>
      </li>)}
    </ul>}
    {data.totalPages > 1 && <nav className="pagination" aria-label="선수 목록 페이지">
      <button className="secondary-button" disabled={data.page === 0} onClick={() => onPageChange(data.page - 1)}>이전</button>
      <span>{data.page + 1} / {data.totalPages}</span>
      <button className="secondary-button" disabled={data.page + 1 >= data.totalPages} onClick={() => onPageChange(data.page + 1)}>다음</button>
    </nav>}
  </>
}
