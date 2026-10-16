// The bearer secret stays in memory only. Remove it before rendering or any navigation.
export function consumePasswordResetAddress(url: URL, replace: (address: string) => void): string | null {
  if (!url.hash.startsWith('#reset=')) return null
  replace(`${url.pathname}${url.search}#access`)
  const token = new URLSearchParams(url.hash.slice(1)).get('reset') ?? ''
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : ''
}
