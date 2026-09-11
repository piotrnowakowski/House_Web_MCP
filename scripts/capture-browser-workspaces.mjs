/**
 * Back up only house-project IndexedDB files from an actual browser profile.
 * Inputs: --source-profile (directory containing IndexedDB), --output (new directory under tmp/).
 * Outputs: raw recovery files, an isolated reader profile, workspaces.json and capture.json.
 * No original profile is opened or modified. Chrome reads a copy behind an intercepted blank page.
 * Usage: node scripts/capture-browser-workspaces.mjs --source-profile <profile> --output tmp/<capture>
 */
import { chromium } from '@playwright/test'
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve, relative, join } from 'node:path'
import { parseArgs } from 'node:util'

const origins = [
  ['http://localhost:5173', 'http_localhost_5173'],
  ['http://127.0.0.1:5173', 'http_127.0.0.1_5173'],
  ['http://natan203.mikrus.xyz:20203', 'http_natan203.mikrus.xyz_20203'],
  ['https://natan203-20203.mikrus.cloud', 'https_natan203-20203.mikrus.cloud_0'],
]
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

async function snapshot(source, target) {
  const hashes = {}
  await mkdir(target, { recursive: true })
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.name === 'LOCK') continue
    if (entry.isSymbolicLink()) throw new Error('Unexpected symlink in project storage')
    const from = join(source, entry.name), to = join(target, entry.name)
    if (entry.isDirectory()) Object.assign(hashes, await snapshot(from, to))
    else {
      const bytes = await readFile(from)
      await writeFile(to, bytes)
      hashes[from] = digest(bytes)
    }
  }
  return hashes
}

async function main() {
  const { values } = parseArgs({ options: { 'source-profile': { type: 'string' }, output: { type: 'string' }, help: { type: 'boolean' } } })
  if (values.help) { console.log('node scripts/capture-browser-workspaces.mjs --source-profile <directory containing IndexedDB> --output tmp/<new-capture>'); return }
  if (!values['source-profile'] || !values.output) throw new Error('Both --source-profile and --output are required')
  const source = resolve(values['source-profile'], 'IndexedDB'), output = resolve(values.output)
  const withinTmp = relative(resolve('tmp'), output)
  if (!withinTmp || withinTmp.startsWith('..') || withinTmp.includes(':')) throw new Error('Output must be a new directory within tmp/')
  await mkdir(output, { recursive: false })
  const available = await readdir(source)
  const found = origins.filter(([, name]) => available.includes(`${name}.indexeddb.leveldb`))
  const hashes = {}
  for (const [, name] of found) {
    for (const suffix of ['.indexeddb.leveldb', '.indexeddb.blob']) {
      if (!available.includes(name + suffix)) continue
      Object.assign(hashes, await snapshot(join(source, name + suffix), join(output, 'raw', name + suffix)))
    }
  }
  for (const [path, hash] of Object.entries(hashes)) {
    if (digest(await readFile(path)) !== hash) throw new Error('Browser storage changed during capture; keep this backup and retry into a new directory')
  }
  if (!found.length) throw new Error('No house workspaces found in the specified profile')
  await cp(join(output, 'raw'), join(output, 'profile', 'Default', 'IndexedDB'), { recursive: true })
  const context = await chromium.launchPersistentContext(join(output, 'profile'), { channel: 'chrome', headless: true })
  const workspaces = []
  try {
    await context.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Read-only recovery</title>' }))
    for (const [origin] of found) {
      const page = await context.newPage()
      await page.goto(origin)
      const entries = await page.evaluate(async () => {
        const databases = await indexedDB.databases()
        if (!databases.some(db => db.name === 'house-web-mcp')) return []
        const db = await new Promise((resolve, reject) => { const request = indexedDB.open('house-web-mcp'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
        try {
          if (!db.objectStoreNames.contains('projects')) return []
          const store = db.transaction('projects', 'readonly').objectStore('projects')
          const read = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
          const [keys, records] = await Promise.all([read(store.getAllKeys()), read(store.getAll())])
          return keys.map((key, index) => [key, records[index]])
        } finally { db.close() }
      })
      workspaces.push({ origin, entries })
      await page.close()
    }
  } finally { await context.close() }
  await writeFile(join(output, 'workspaces.json'), JSON.stringify(workspaces, null, 2) + '\n')
  await writeFile(join(output, 'capture.json'), JSON.stringify({ source, capturedAt: new Date().toISOString(), origins: found.map(([origin]) => origin), hashes }, null, 2) + '\n')
  console.log(JSON.stringify({ output, workspaces: workspaces.map(({ origin, entries }) => ({ origin, projects: entries.filter(([key]) => String(key).startsWith('workspace/')).map(([key, value]) => ({ key, name: value.project?.name, revision: value.project?.revision })) })) }, null, 2))
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
