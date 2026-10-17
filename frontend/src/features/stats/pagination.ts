// Slice only after filtering and sorting; summary totals always use the full response.
export function statsPage<T>(rows: T[], requestedPage: number, size: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / size))
  const page = Math.min(Math.max(0, requestedPage), totalPages - 1)
  const start = page * size
  return { page, totalPages, items: rows.slice(start, start + size), from: rows.length ? start + 1 : 0, to: Math.min(start + size, rows.length) }
}
