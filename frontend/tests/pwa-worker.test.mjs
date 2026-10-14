import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const workerSource = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
const noticeSource = await readFile(new URL('../public/offline.html', import.meta.url), 'utf8')
const origin = 'https://jochook-on.example'
const offlineUrl = `${origin}/offline.html`
const currentCache = 'jochook-on-offline-v2'

function responseAt(url, body = 'public offline notice', init = {}) {
  const response = new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' }, ...init })
  Object.defineProperty(response, 'url', { value: url })
  return response
}

function createWorker({ network = async () => responseAt(offlineUrl), initialCaches = {} } = {}) {
  const handlers = new Map()
  const storage = new Map(Object.entries(initialCaches).map(([name, entries]) => [name, new Map(Object.entries(entries))]))
  const calls = { fetch: [], put: [], deletedCaches: [], deletedEntries: [], skipWaiting: 0, claim: 0 }
  const cacheKey = value => typeof value === 'string' ? new URL(value, origin).href : value.url
  const caches = {
    async keys() { return [...storage.keys()] },
    async delete(name) { calls.deletedCaches.push(name); return storage.delete(name) },
    async open(name) {
      if (!storage.has(name)) storage.set(name, new Map())
      const entries = storage.get(name)
      return {
        async put(request, response) {
          calls.put.push({ name, url: cacheKey(request) })
          entries.set(cacheKey(request), response)
        },
        async match(request) { return entries.get(cacheKey(request))?.clone() },
        async keys() { return [...entries.keys()].map(url => new Request(url)) },
        async delete(request) { calls.deletedEntries.push(cacheKey(request)); return entries.delete(cacheKey(request)) },
      }
    },
  }
  const context = vm.createContext({
    URL, Request, Response, caches,
    fetch: async (...args) => { calls.fetch.push(args); return network(...args) },
    self: {
      location: { origin },
      addEventListener(type, listener) { handlers.set(type, listener) },
      skipWaiting() { calls.skipWaiting++; return Promise.resolve() },
      clients: { claim() { calls.claim++; return Promise.resolve() } },
    },
  })
  vm.runInContext(workerSource, context, { filename: 'sw.js' })
  return {
    calls, storage,
    async lifecycle(type) {
      const promises = []
      handlers.get(type)({ waitUntil(promise) { promises.push(promise) } })
      await Promise.all(promises)
    },
    fetch({ url = `${origin}/`, method = 'GET', mode = 'navigate' } = {}) {
      const request = { url, method, mode }
      let intercepted = false
      let response
      handlers.get('fetch')({ request, respondWith(promise) { intercepted = true; response = promise } })
      return { intercepted, response, request }
    },
  }
}

test('install stores only the public notice, omits credentials, and does not force activation', async () => {
  const worker = createWorker()
  await worker.lifecycle('install')
  assert.deepEqual(worker.calls.put, [{ name: currentCache, url: offlineUrl }])
  assert.equal(worker.calls.fetch.length, 1)
  const [request] = worker.calls.fetch[0]
  assert.equal(request.url, offlineUrl)
  assert.equal(request.credentials, 'omit')
  assert.equal(request.cache, 'no-store')
  assert.equal(request.redirect, 'error')
  assert.equal(worker.calls.skipWaiting, 0)
  assert.equal(worker.calls.claim, 0)
})

test('installation rejects errors, redirects, wrong URLs, and non-HTML without caching them', async () => {
  for (const response of [
    responseAt(offlineUrl, 'unavailable', { status: 503 }),
    responseAt(`${origin}/login`),
    responseAt(offlineUrl, '{}', { headers: { 'Content-Type': 'application/json' } }),
    Object.defineProperty(responseAt(offlineUrl), 'redirected', { value: true }),
  ]) {
    const worker = createWorker({ network: async () => response })
    await assert.rejects(worker.lifecycle('install'), /Offline notice unavailable/)
    assert.equal(worker.calls.put.length, 0)
    assert.equal(worker.storage.size, 0)
  }
  const failedNetwork = createWorker({ network: async () => { throw new TypeError('offline') } })
  await assert.rejects(failedNetwork.lifecycle('install'), /offline/)
  assert.equal(failedNetwork.calls.put.length, 0)
})

test('API and health navigation requests are never intercepted, including encoded paths', () => {
  const worker = createWorker()
  for (const path of ['/api', '/api/v1/auth/me', '/api/v1/players', '/api/v1/matches', '/api/v1/players/template',
    '/api%2Fv1%2Fauth%2Fme', '/actuator', '/actuator/health', '/health', '/healthcheck', '/internal-health', '/internal-health/status']) {
    assert.equal(worker.fetch({ url: `${origin}${path}` }).intercepted, false, path)
  }
  assert.equal(worker.calls.fetch.length, 0)
  assert.equal(worker.calls.put.length, 0)
})

test('POST, cross-origin navigation, assets, and fetch requests stay under browser control', () => {
  const worker = createWorker()
  for (const request of [
    { method: 'POST' },
    { method: 'DELETE' },
    { url: 'https://another.example/' },
    { url: `${origin}/assets/index.js`, mode: 'no-cors' },
    { url: `${origin}/assets/index.css`, mode: 'no-cors' },
    { url: `${origin}/icons/icon.png`, mode: 'no-cors' },
    { url: `${origin}/manifest.webmanifest`, mode: 'cors' },
    { url: `${origin}/download.xlsx`, mode: 'same-origin' },
    { url: `${origin}/`, mode: 'cors' },
    { url: `${origin}/invalid%zz` },
  ]) assert.equal(worker.fetch(request).intercepted, false, JSON.stringify(request))
  assert.equal(worker.calls.fetch.length, 0)
  assert.equal(worker.calls.put.length, 0)
})

test('online navigation returns the original response and never caches application HTML', async () => {
  const original = responseAt(`${origin}/`, '<html>synthetic account screen</html>')
  const worker = createWorker({ network: async () => original })
  const navigation = worker.fetch()
  assert.equal(navigation.intercepted, true)
  assert.equal(await navigation.response, original)
  assert.equal(worker.calls.fetch[0][0], navigation.request)
  assert.equal(worker.calls.fetch[0][1].cache, 'no-store')
  assert.equal(worker.calls.put.length, 0)
  assert.equal(worker.storage.size, 0)
})

test('HTTP 401, 403, 404, and 503 remain server responses rather than offline pages', async () => {
  for (const status of [401, 403, 404, 503]) {
    const original = responseAt(`${origin}/`, `server ${status}`, { status })
    const worker = createWorker({
      network: async () => original,
      initialCaches: { [currentCache]: { [offlineUrl]: responseAt(offlineUrl) } },
    })
    assert.equal(await worker.fetch().response, original)
    assert.equal(worker.calls.put.length, 0)
  }
})

test('only a network failure returns the offline notice from this apps current cache', async () => {
  const worker = createWorker({
    network: async () => { throw new TypeError('network unavailable') },
    initialCaches: {
      'another-app': { [offlineUrl]: responseAt(offlineUrl, 'wrong application') },
      [currentCache]: { [offlineUrl]: responseAt(offlineUrl, 'safe public notice') },
    },
  })
  const response = await worker.fetch({ url: `${origin}/?invitation=synthetic-value` }).response
  assert.equal(await response.text(), 'safe public notice')
  assert.equal(worker.calls.put.length, 0)
  assert.equal(worker.storage.get(currentCache).size, 1)
})

test('a missing offline cache returns a public 503 notice without persisting request data', async () => {
  const worker = createWorker({ network: async () => { throw new TypeError('offline') } })
  const response = await worker.fetch().response
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.match(await response.text(), /저장되지 않습니다/)
  assert.equal(worker.calls.put.length, 0)
})

test('activation cleans only owned versioned caches and prunes entries outside the notice allowlist', async () => {
  const publicResponse = responseAt(offlineUrl)
  const worker = createWorker({ initialCaches: {
    'another-app-v1': { [`${origin}/`]: publicResponse },
    'jochook-on-other-feature-v1': { [`${origin}/`]: publicResponse },
    'jochook-on-offline-v1-backup': { [`${origin}/`]: publicResponse },
    'jochook-on-offline-v0': { [offlineUrl]: publicResponse },
    [currentCache]: {
      [offlineUrl]: publicResponse,
      [`${origin}/api/v1/players`]: publicResponse,
      [`${origin}/`]: publicResponse,
      [`${offlineUrl}?unapproved=1`]: publicResponse,
    },
  } })
  await worker.lifecycle('activate')
  assert.deepEqual(worker.calls.deletedCaches, ['jochook-on-offline-v0'])
  assert.deepEqual([...worker.storage.get(currentCache).keys()], [offlineUrl])
  assert.equal(worker.storage.has('another-app-v1'), true)
  assert.equal(worker.storage.has('jochook-on-other-feature-v1'), true)
  assert.equal(worker.storage.has('jochook-on-offline-v1-backup'), true)
  assert.equal(worker.calls.skipWaiting, 0)
  assert.equal(worker.calls.claim, 0)
})

test('offline notice is self-contained Korean guidance with a safe root retry link', () => {
  assert.match(noticeSource, /<html lang="ko">/)
  assert.match(noticeSource, /인터넷 연결이 필요/)
  assert.match(noticeSource, /자동으로 저장되지 않습니다/)
  assert.match(noticeSource, /<a href="\/">/)
  assert.doesNotMatch(noticeSource, /<(?:script|link|iframe|img)\b|url\(|https?:\/\//i)
})
