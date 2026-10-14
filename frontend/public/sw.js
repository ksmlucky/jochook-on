// Keep the cache limited to this public notice. Bump the version when it changes.
const OFFLINE_CACHE = 'jochook-on-offline-v2'
const OFFLINE_PATH = '/offline.html'
const OFFLINE_URL = new URL(OFFLINE_PATH, self.location.origin).href

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(new Request(OFFLINE_URL, {
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
    }))
    if (!response.ok || response.redirected || response.url !== OFFLINE_URL
        || !response.headers.get('Content-Type')?.toLowerCase().startsWith('text/html')) {
      throw new Error('Offline notice unavailable')
    }
    const cache = await caches.open(OFFLINE_CACHE)
    await cache.put(OFFLINE_URL, response)
  })())
  // Normal activation waits for existing pages to close; never discard active drafts.
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names
      .filter(name => /^jochook-on-offline-v\d+$/.test(name) && name !== OFFLINE_CACHE)
      .map(name => caches.delete(name)))
    const cache = await caches.open(OFFLINE_CACHE)
    const requests = await cache.keys()
    await Promise.all(requests
      .filter(request => request.url !== OFFLINE_URL)
      .map(request => cache.delete(request)))
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET' || request.mode !== 'navigate') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  let path
  try {
    path = decodeURIComponent(url.pathname)
  } catch {
    return
  }
  if (path === '/api' || path.startsWith('/api/') || path.startsWith('/actuator')
      || path.startsWith('/health') || path.startsWith('/internal-health')) return

  event.respondWith((async () => {
    try {
      // Do not put app HTML, sessions, or team data in either an SW or HTTP cache.
      // HTTP errors are real server responses, not a reason to show an offline notice.
      return await fetch(request, { cache: 'no-store' })
    } catch {
      try {
        const cache = await caches.open(OFFLINE_CACHE)
        const notice = await cache.match(OFFLINE_URL)
        if (notice) return notice
      } catch {
        // Storage can be unavailable or cleared independently of the worker.
      }
      return new Response('인터넷 연결이 필요합니다. 연결을 확인한 뒤 다시 접속해 주세요. 오프라인에서는 기록이 저장되지 않습니다.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }
  })())
})
