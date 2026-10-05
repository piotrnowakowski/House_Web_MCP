// Disposable PostgreSQL-backed test server. Never loads .env or real credentials.
import { PGlite } from '@electric-sql/pglite'
import type pg from 'pg'
import { createHash } from 'node:crypto'
import { createApi } from '../../server/app'
import { migrate } from '../../server/database'
const db = new PGlite()
let tail = Promise.resolve()
const pool = {
  query: (sql: string, params?: unknown[]) => db.query(sql, params),
  connect: async () => {
    let unlock!: () => void
    const previous = tail
    tail = new Promise<void>(resolve => { unlock = resolve })
    await previous
    return { query: (sql: string, params?: unknown[]) => params ? db.query(sql, params) : sql.includes('CREATE TABLE') ? db.exec(sql).then(results => results.at(-1)) : db.query(sql), release: () => unlock() }
  },
} as unknown as pg.Pool
await migrate(pool)
const app = createApi(pool, createHash('sha256').update('test-only-connection-key-12345678901234567890').digest('hex'), [process.env.APP_URL ?? 'http://127.0.0.1:5193'])
await app.listen({ host: '127.0.0.1', port: 5194 })
console.log('Disposable sync API ready on 5194')
