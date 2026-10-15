export function YearOptionsStatus({ loading, error, onRetry }: { loading: boolean; error: boolean; onRetry: () => void }) {
  if (error) return <div className="year-options-error" role="alert"><p>기록이 있는 연도 목록을 확인하지 못했어요. 현재 표시된 연도 외에도 기록이 있을 수 있어요. 전체 기간 조회는 계속 사용할 수 있어요.</p><button type="button" className="secondary-button" onClick={onRetry}>연도 다시 불러오기</button></div>
  return loading ? <p className="year-options-status" role="status">기록이 있는 연도를 확인하고 있어요. 현재 연도와 전체 기간은 먼저 조회할 수 있어요.</p> : null
}
