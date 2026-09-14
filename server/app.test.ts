import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import type pg from 'pg'
import { createHash, randomUUID } from 'node:crypto'
import { createApi } from './app'
import { migrate } from './database'
import { createTerrainProject } from '../src/domain/terrain'

const db = new PGlite()
// Real embedded PostgreSQL SQL/schema execution. No network or supplied credentials.
const client = { query: (sql: string, params?: unknown[]) => params ? db.query(sql, params) : sql.includes('CREATE TABLE') ? db.exec(sql).then(results => results.at(-1)) : db.query(sql), release: () => undefined }
const pool = { query: client.query, connect: async () => client } as unknown as pg.Pool
const key = 'test-only-connection-key-12345678901234567890'
const app = createApi(pool, createHash('sha256').update(key).digest('hex'), ['https://house.example'])
const headers = { authorization: `Bearer ${key}`, origin: 'https://house.example' }
const workspace = { version: 1, project: createTerrainProject({ name: 'API test', widthM: 30, depthM: 40, northDegrees: 0, latitude: 52, longitude: 21, timezone: 'Europe/Warsaw' }), proposals: [], draftChangeSets: [] }
beforeAll(async () => { await migrate(pool); await app.ready() }, 30000)
afterAll(async () => { await app.close(); await db.close() })
describe('private PostgreSQL sync API', () => {
  it('requires the connection key and rejects foreign origins', async () => {
    expect((await app.inject({ url: '/api/sync/projects' })).statusCode).toBe(401)
    expect((await app.inject({ url: '/api/sync/projects', headers: { ...headers, origin: 'https://foreign.example' } })).statusCode).toBe(403)
    const options = await app.inject({ method: 'OPTIONS', url: '/api/sync/projects', headers: { origin: 'https://house.example', 'access-control-request-method': 'PUT', 'access-control-request-headers': 'authorization,content-type' } })
    expect(options.headers['access-control-allow-origin']).toBe('https://house.example')
  })
  it('conditionally creates/updates, preserves history, and deduplicates lost responses', async () => {
    const payload = { expectedVersion: 0, mutationId: randomUUID(), workspace }
    const first = await app.inject({ method: 'PUT', url: '/api/sync/workspace', headers, payload })
    expect(first.statusCode, first.body).toBe(200)
    expect(first.json().serverVersion).toBe(1)
    expect((await app.inject({ method: 'PUT', url: '/api/sync/workspace', headers, payload })).json()).toEqual(first.json())
    const conflict = await app.inject({ method: 'PUT', url: '/api/sync/workspace', headers, payload: { ...payload, mutationId: randomUUID() } })
    expect(conflict.statusCode).toBe(409)
    const changed = structuredClone(workspace); changed.project.name = 'Second'; changed.project.revision = 1
    expect((await app.inject({ method: 'PUT', url: '/api/sync/workspace', headers, payload: { expectedVersion: 1, mutationId: randomUUID(), workspace: changed } })).json().serverVersion).toBe(2)
    expect((await app.inject({ method: 'PUT', url: '/api/sync/workspace', headers, payload })).json().serverVersion).toBe(1)
    expect((await app.inject({ url: `/api/sync/workspace?ref=${encodeURIComponent(workspace.project.ref)}`, headers })).json().workspace.project.name).toBe('Second')
    expect((await db.query('SELECT * FROM house_sync_versions')).rows).toHaveLength(2)
    expect((await db.query('SELECT * FROM house_sync_receipts')).rows).toHaveLength(2)
    expect((await app.inject({ method: 'PUT', url: '/api/sync/workspace', headers, payload: { ...payload, workspace: changed } })).statusCode).toBe(409)
  })
  it('rejects invalid input without storing partial work', async () => {
    expect((await app.inject({ method: 'PUT', url: '/api/sync/workspace', headers, payload: { expectedVersion: 0, mutationId: randomUUID(), workspace: {} } })).statusCode).toBe(422)
    expect((await app.inject({ url: '/api/sync/workspace?ref=missing', headers })).statusCode).toBe(404)
    const result = await app.inject({ url: '/api/sync/projects', headers })
    expect(result.json()).toHaveLength(1)
    expect(result.headers['cache-control']).toBe('no-store')
  })
})

it('supports explicitly configured public read/write access without exposing credentials',async()=>{
 const publicApi=createApi(pool,'',['https://house.example'],true);await publicApi.ready()
 try {
  expect((await publicApi.inject({url:'/api/sync/access'})).json()).toEqual({publicAccess:true})
  expect((await publicApi.inject({url:'/api/sync/projects'})).statusCode).toBe(200)
  const copy=structuredClone(workspace);copy.project.ref='project/public-sync-test'
  expect((await publicApi.inject({method:'PUT',url:'/api/sync/workspace',payload:{expectedVersion:0,mutationId:randomUUID(),workspace:copy}})).statusCode).toBe(200)
  expect((await publicApi.inject({url:'/api/sync/projects',headers:{origin:'https://foreign.example'}})).statusCode).toBe(403)
  expect((await app.inject({url:'/api/sync/access'})).json()).toEqual({publicAccess:false})
  expect((await app.inject({url:'/api/sync/projects'})).statusCode).toBe(401)
 }finally{await publicApi.close()}
})
