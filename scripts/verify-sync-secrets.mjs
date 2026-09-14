/** Check release text assets against configured secrets without printing their values. */
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { parse } from 'dotenv'
const env = parse(await readFile('.env'))
const secrets = ['PGPASSWORD', 'VPS_PASSWORD', 'HOUSE_SYNC_CONNECTION_KEY'].map(name => env[name]).filter(Boolean)
if (execFileSync('git', ['ls-files', '--', '.env'], { encoding: 'utf8' }).trim()) throw new Error('Private .env is tracked')
let checked = 0
async function scan(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name)
    if (entry.isDirectory()) await scan(file)
    else if (entry.name.startsWith('.env')) throw new Error('Environment file found in release output')
    else if (/\.(js|mjs|map|json|html|css)$/.test(entry.name)) {
      const text = await readFile(file, 'utf8'); checked++
      if (secrets.some(secret => text.includes(secret))) throw new Error('Configured secret found in release output; release blocked')
    }
  }
}
await scan('dist'); await scan('dist-server')
console.log(`Secret scan passed: ${checked} release text files; .env remains untracked.`)
