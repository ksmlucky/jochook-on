// Serves the existing build and forwards API calls to the real Spring Boot server.
import { createServer, request } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../frontend/dist')
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' }
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:5173')
  if (url.pathname.startsWith('/api/') || url.pathname === '/actuator/health') {
    const upstream = request({ hostname: '127.0.0.1', port: 8080, path: url.pathname + url.search, method: req.method, headers: { ...req.headers, host: '127.0.0.1:8080' } }, incoming => {
      res.writeHead(incoming.statusCode, incoming.headers)
      incoming.pipe(res)
    })
    upstream.on('error', () => { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{"error":"API is not running"}') })
    req.pipe(upstream)
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return }
  try {
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
    if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return }
    const data = await readFile(target)
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
    res.end(req.method === 'HEAD' ? undefined : data)
  } catch { res.writeHead(404).end('Not found') }
}).listen(5173, '127.0.0.1', () => console.log('JochookON: http://127.0.0.1:5173'))
