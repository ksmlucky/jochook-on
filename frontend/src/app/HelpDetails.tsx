import type { ReactNode } from 'react'
import './help-details.css'

/** Secondary instructions stay available without crowding the main action. */
export function HelpDetails({ title, children }: { title: string; children: ReactNode }) {
  return <details className="help-details">
    <summary>{title}</summary>
    <div className="help-details-body">{children}</div>
  </details>
}
