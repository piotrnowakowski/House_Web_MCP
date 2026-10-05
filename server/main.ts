import 'dotenv/config'
import { createPool, migrate } from './database'
import { createApi } from './app'

const pool = createPool()
const app = createApi(pool, process.env.HOUSE_SYNC_KEY_HASH ?? '', (process.env.HOUSE_SYNC_ORIGINS ?? '').split(',').filter(Boolean), process.env.HOUSE_SYNC_PUBLIC_ACCESS === 'true')
try {
  await migrate(pool)
  await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 8081) })
  console.info('Workspace sync API ready')
} catch { console.error('Sync startup failed. Check database connectivity, TLS trust and required runtime configuration.'); await pool.end(); process.exit(1) }
const stop = async () => { await app.close(); await pool.end() }
process.once('SIGTERM', stop)
process.once('SIGINT', stop)
