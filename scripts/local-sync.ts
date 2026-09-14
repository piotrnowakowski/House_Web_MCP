import type { Plugin } from 'vite'
import { loadEnv } from 'vite'

export function localSyncPlugin(): Plugin {
  return {
    name: 'private-local-sync',
    apply: 'serve',
    configureServer(server) {
      const env = { ...loadEnv(server.config.mode, server.config.envDir, ''), ...process.env }
      const key = env.HOUSE_SYNC_CONNECTION_KEY ?? ''
      const target = new URL(env.HOUSE_SYNC_API_URL ?? 'https://natan203-20203.mikrus.cloud')
      if (target.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(target.hostname)) throw new Error('Sync upstream requires HTTPS')
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/local-sync/')) return next()
        const host = req.headers.host ?? ''
        const peer = req.socket.remoteAddress ?? ''
        const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer)
        const origin = req.headers.origin
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Content-Type', 'application/json')
        if (!local || (origin && origin !== `http://${host}`) || req.headers['x-house-local-sync'] !== '1') { res.statusCode = 403; res.end('{"error":"Local app only"}'); return }
        const path = req.url.slice('/api/local-sync/'.length)
        const configured = /^[A-Za-z0-9_-]{32,128}$/.test(key)
        if (path === 'configuration' && req.method === 'GET') { res.end(JSON.stringify({ configured })); return }
        if (!configured) { res.statusCode = 503; res.end('{"error":"Local sync configuration missing"}'); return }
        if (!((req.method === 'GET' && /^(projects|workspace\?ref=[^&]+)$/.test(path)) || (req.method === 'PUT' && path === 'workspace'))) { res.statusCode = 404; res.end('{}'); return }
        try {
          const chunks: Buffer[] = []; let size = 0
          for await (const part of req) { const chunk = Buffer.from(part); size += chunk.length; if (size > 20 * 1024 * 1024) { res.statusCode = 413; res.end('{}'); return } chunks.push(chunk) }
          const upstream = await fetch(new URL(`/api/sync/${path}`, target), { method: req.method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: req.method === 'PUT' ? Buffer.concat(chunks) : undefined, redirect: 'error', signal: AbortSignal.timeout(20000) })
          res.statusCode = upstream.status; res.end(await upstream.text())
        } catch { res.statusCode = 502; res.end('{"error":"Mikrus is unavailable; local work is preserved"}') }
      })
    },
  }
}
