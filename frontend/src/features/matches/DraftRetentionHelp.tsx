export function DraftRetentionHelp({ inList = false }: { inList?: boolean }) {
  return <details className="match-recovery-help">
    <summary>초안 보관 안내 <span>최대 24시간</span></summary>
    <ul>
      <li>같은 탭·운영진 계정·팀에서 이어 쓸 수 있어요.</li>
      <li>직접 로그아웃하면 초안이 삭제돼요. 탭을 닫은 뒤에는 복원되지 않을 수 있어요.</li>
      <li>경기 기록은 저장 버튼을 눌러야 반영돼요.</li>
      {inList && <li>다른 경기를 열려면 이 초안을 먼저 저장하거나 버려 주세요.</li>}
    </ul>
  </details>
}
