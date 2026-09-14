import { readFileSync } from 'node:fs'
import pg from 'pg'

export function createPool(env: NodeJS.ProcessEnv = process.env) {
  for (const name of ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']) if (!env[name]) throw new Error(`Missing ${name}`)
  if (!['verify-full', 'require'].includes(env.PGSSLMODE ?? '')) throw new Error('PGSSLMODE must be verify-full or explicitly require')
  return new pg.Pool({ host: env.PGHOST, port: Number(env.PGPORT ?? 5432), database: env.PGDATABASE, user: env.PGUSER, password: env.PGPASSWORD,
    ssl: { rejectUnauthorized: env.PGSSLMODE !== 'require', ...(env.PGSSLROOTCERT ? { ca: readFileSync(env.PGSSLROOTCERT, 'utf8') } : {}) },
    max: 4, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, statement_timeout: 15000,
  })
}
export async function migrate(pool: pg.Pool) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(20203, 1)")
    await client.query(`CREATE TABLE IF NOT EXISTS house_sync_projects (
      ref text PRIMARY KEY, server_version integer NOT NULL CHECK(server_version > 0), workspace jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS house_sync_versions (
      ref text NOT NULL REFERENCES house_sync_projects(ref), server_version integer NOT NULL, workspace jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(ref, server_version));
      CREATE TABLE IF NOT EXISTS house_sync_receipts (
      ref text NOT NULL REFERENCES house_sync_projects(ref), mutation_id uuid NOT NULL, request_hash text NOT NULL, server_version integer NOT NULL,
      PRIMARY KEY(ref, mutation_id), FOREIGN KEY(ref, server_version) REFERENCES house_sync_versions(ref, server_version));`)
    await client.query('COMMIT')
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}
