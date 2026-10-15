import type { MatchKind } from './api'
import { competitionCategory } from './competitionCategory'
import './match-category.css'

export function MatchCategoryBadge({ match }: { match: { kind: MatchKind; tournamentId?: number | null } }) {
  const category = competitionCategory(match)
  return <span className={`match-category-badge is-${category.key}`}>
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {category.key === 'tournament' ? <><path d="M7 3h10v6a5 5 0 0 1-10 0V3Z" /><path d="M7 5H4v3a4 4 0 0 0 4 4m9-7h3v3a4 4 0 0 1-4 4M12 14v6m-4 1h8" /></>
        : category.key === 'league' ? <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 10h18m-13 5h2m4 0h2m-8 3h2" /></>
          : <><circle cx="8" cy="7" r="3" /><circle cx="17" cy="8" r="2.5" /><path d="M2 21v-3a6 6 0 0 1 12 0v3m2-7a5 5 0 0 1 6 5v2" /></>}
    </svg>{category.label}
  </span>
}
