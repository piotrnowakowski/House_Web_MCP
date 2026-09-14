import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { createHash, timingSafeEqual } from 'node:crypto'
import type pg from 'pg'
import { z } from 'zod'
import { stableJson, validateWorkspace } from '../src/domain/workspaceSync'

export function createApi(pool: pg.Pool, keyHash: string, origins: string[]) {
  if (!/^[a-f0-9]{64}$/.test(keyHash)) throw new Error('A SHA-256 connection-key hash is required')
  const app = Fastify({ logger: false, bodyLimit: 20 * 1024 * 1024 })
  app.register(cors, { origin: origins, methods: ['GET', 'PUT', 'OPTIONS'], allowedHeaders: ['Authorization', 'Content-Type'] })
  app.register(rateLimit, { max: 120, timeWindow: '1 minute' })
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    if (request.method === 'OPTIONS' || request.url === '/api/sync/health') return
    if (request.headers.origin && !origins.includes(request.headers.origin)) return reply.code(403).send({ error: 'Origin not allowed' })
    const bearer = request.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)?.[1]
    if (!bearer || !timingSafeEqual(createHash('sha256').update(bearer).digest(), Buffer.from(keyHash, 'hex'))) return reply.code(401).send({ error: 'Invalid connection key' })
  })
  app.setErrorHandler((error, _request, reply) => {
    const status = (error as { statusCode?: number }).statusCode ?? 500
    reply.code(status).send({ error: status === 413 ? 'Workspace exceeds 20 MB' : status === 429 ? 'Too many requests' : 'Sync service unavailable; local work is preserved' })
  })
  app.get('/api/sync/health', async (_request, reply) => {
    try { await pool.query('SELECT 1'); return { status: 'ready' } } catch { return reply.code(503).send({ status: 'unavailable' }) }
  })
  app.get('/api/sync/projects', async () => {
    const result = await pool.query("SELECT ref, workspace->'project'->>'name' AS name, server_version AS \"serverVersion\" FROM house_sync_projects ORDER BY updated_at DESC")
    return result.rows
  })
  app.get('/api/sync/workspace', async (request, reply) => {
    const query = z.object({ ref: z.string().min(1).max(512) }).safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: 'A project ref is required' })
    const result = await pool.query('SELECT server_version AS "serverVersion", workspace FROM house_sync_projects WHERE ref=$1', [query.data.ref])
    return result.rows[0] ?? reply.code(404).send({ error: 'Workspace not found' })
  })
  app.put('/api/sync/workspace', async (request, reply) => {
    const parsed = z.object({ expectedVersion: z.number().int().nonnegative().max(2147483646), mutationId: z.string().uuid(), workspace: z.unknown() }).strict().safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid sync request' })
    let workspace
    try { workspace = validateWorkspace(parsed.data.workspace) } catch { return reply.code(422).send({ error: 'Invalid workspace schema or geometry' }) }
    if (workspace.project.ref.length > 512) return reply.code(422).send({ error: 'Project ref too long' })
    const { expectedVersion, mutationId } = parsed.data
    const ref = workspace.project.ref
    const hash = createHash('sha256').update(stableJson(parsed.data)).digest('hex')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 20203))', [ref])
      const receipt = await client.query(`SELECT r.request_hash, v.server_version AS "serverVersion", v.workspace FROM house_sync_receipts r
        JOIN house_sync_versions v USING(ref, server_version) WHERE r.ref=$1 AND r.mutation_id=$2`, [ref, mutationId])
      if (receipt.rows[0]) {
        await client.query('ROLLBACK')
        if (receipt.rows[0].request_hash !== hash) return reply.code(409).send({ error: 'Mutation ID already used for another request' })
        return { serverVersion: receipt.rows[0].serverVersion, workspace: receipt.rows[0].workspace }
      }
      const current = await client.query('SELECT server_version FROM house_sync_projects WHERE ref=$1 FOR UPDATE', [ref])
      if ((current.rows[0]?.server_version ?? 0) !== expectedVersion) {
        await client.query('ROLLBACK')
        return reply.code(409).send({ error: 'Shared workspace changed; sync again to review' })
      }
      const version = expectedVersion + 1
      await client.query(`INSERT INTO house_sync_projects(ref,server_version,workspace) VALUES($1,$2,$3)
        ON CONFLICT(ref) DO UPDATE SET server_version=$2,workspace=$3,updated_at=now()`, [ref, version, workspace])
      await client.query('INSERT INTO house_sync_versions(ref,server_version,workspace) VALUES($1,$2,$3)', [ref, version, workspace])
      await client.query('INSERT INTO house_sync_receipts(ref,mutation_id,request_hash,server_version) VALUES($1,$2,$3,$4)', [ref, mutationId, hash, version])
      await client.query('COMMIT')
      return { serverVersion: version, workspace }
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  })
  return app
}
