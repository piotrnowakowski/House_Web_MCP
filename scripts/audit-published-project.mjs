/**
 * Brief: Verify published house data, browser migration, conflicts and reload in isolated Chrome profiles.
 * Inputs: --url (default http://127.0.0.1:5173/), --output (default output/published-project), --help.
 * Files: project-data/zielonki/{project,legacy-base,recovered-workspace-r40}.json; no environment variables.
 * Outputs: JSON findings and desktop/mobile screenshots. Never reads or modifies the user's browser profile.
 * Usage from repository root: node scripts/audit-published-project.mjs --url http://127.0.0.1:5173/
 */
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

async function records(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('house-web-mcp')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const store = db.transaction('projects', 'readonly').objectStore('projects')
      return await new Promise((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result.filter((value) => value?.project))
        request.onerror = () => reject(request.error)
      })
    } finally { db.close() }
  })
}

async function main() {
  const { values } = parseArgs({ options: {
    url: { type: 'string', default: 'http://127.0.0.1:5173/' },
    output: { type: 'string', default: 'output/published-project' }, help: { type: 'boolean' },
  } })
  if (values.help) { console.log('Usage: node scripts/audit-published-project.mjs [--url URL] [--output DIR]'); return }
  const read = async (name) => JSON.parse(await readFile(`project-data/zielonki/${name}.json`, 'utf8'))
  const published = await read('project'), legacy = await read('legacy-base'), recovered = await read('recovered-workspace-r40')
  await mkdir(values.output, { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const reports = []
  try {
    for (const scenario of ['fresh-desktop', 'fresh-mobile', 'legacy', 'recovered', 'conflict']) {
      const mobile = scenario.endsWith('mobile')
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile })
      try {
        const page = await context.newPage(), errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.addInitScript(() => {
          const state = window.__publishedGeometryAudit = { pending: 0, completed: 0, errors: [] }
          const NativeWorker = window.Worker
          window.Worker = class extends NativeWorker {
            constructor(...args) {
              super(...args)
              this.addEventListener('message', ({ data }) => {
                if (!data?.requestId) return
                state.pending--; state.completed++
                if (data.error) state.errors.push(data.error)
              })
            }
            postMessage(data, ...args) {
              if (data?.requestId && data.elements) state.pending++
              return super.postMessage(data, ...args)
            }
          }
        })
        if (['legacy', 'recovered', 'conflict'].includes(scenario)) {
          const workspace = scenario === 'recovered' ? recovered : { version: 1, project: structuredClone(legacy), proposals: [], draftChangeSets: [] }
          if (scenario === 'conflict') workspace.project.buildings[0].roof.pitchDegrees = 39
          const bootstrap = new URL('project-data-audit-bootstrap', values.url).href
          await page.route(bootstrap, (route) => route.fulfill({ contentType: 'text/html', body: '<title>Isolated data fixture</title>' }))
          await page.goto(bootstrap)
          await page.evaluate(async (workspace) => {
            const db = await new Promise((resolve, reject) => {
              const request = indexedDB.open('house-web-mcp', 2)
              request.onupgradeneeded = () => request.result.createObjectStore('projects')
              request.onsuccess = () => resolve(request.result)
              request.onerror = () => reject(request.error)
            })
            try {
              await new Promise((resolve, reject) => {
                const tx = db.transaction('projects', 'readwrite'), store = tx.objectStore('projects')
                store.put(workspace, `workspace/${workspace.project.ref}`)
                store.put(workspace.project.ref, 'active')
                tx.oncomplete = resolve
                tx.onerror = () => reject(tx.error)
              })
            } finally { db.close() }
          }, workspace)
        }
        await page.goto(values.url, { waitUntil: 'domcontentloaded', timeout: 60000 })
        const open = page.getByRole('button', { name: /Zielonki house study/ })
        await expect(open).toBeEnabled({ timeout: 30000 })
        if (scenario === 'conflict') {
          await expect(page.getByRole('alert')).toContainText('conflicting changes')
          const saved = await records(page)
          assert.equal(saved.find((w) => w.project.ref === published.ref).project.buildings[0].roof.pitchDegrees, 39)
          assert.equal(saved.find((w) => w.project.ref.includes('/published-')).project.landscape.plants.length, published.landscape.plants.length)
        } else {
          await open.click()
          await expect(page.getByRole('button', { name: 'House interior', exact: true })).toBeVisible()
          await expect.poll(async () => (await records(page)).find((w) => w.project.ref === published.ref)?.project.landscape.plants.length).toBe(published.landscape.plants.length)
          const saved = (await records(page)).find((w) => w.project.ref === published.ref)
          assert.deepEqual(saved.project.landscape.plants, published.landscape.plants)
          assert.equal(saved.project.site.northDegrees, published.site.northDegrees)
          assert.deepEqual(saved.project.site.neighbors, published.site.neighbors)
          assert.equal(saved.project.buildings[0].roof.pitchDegrees, published.buildings[0].roof.pitchDegrees)
          assert.deepEqual(saved.project.buildings[0].roof.segments.find((segment) => segment.ref.endsWith('/front-barn')).gableGlazing,
            published.buildings[0].roof.segments.find((segment) => segment.ref.endsWith('/front-barn')).gableGlazing)
          if (scenario === 'recovered') assert.equal(saved.proposals.length, 19)
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
          await expect(open).toBeEnabled({ timeout: 30000 })
          await open.click()
          await expect(page.getByRole('button', { name: 'House interior', exact: true })).toBeVisible()
          assert.equal((await records(page)).find((w) => w.project.ref === published.ref).project.landscape.plants.length, published.landscape.plants.length)
          // Wait for the suspended 3D scene to draw, rather than capturing its initial black buffer.
          await page.waitForFunction(() => new Promise((resolve) => requestAnimationFrame(() => {
            const canvas = document.querySelector('canvas')
            const gl = canvas?.getContext('webgl2')
            if (!gl || gl.isContextLost()) { resolve(false); return }
            const pixel = new Uint8Array(4)
            gl.readPixels(5, 5, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
            resolve(pixel[0] + pixel[1] + pixel[2] > 30)
          })), null, { timeout: 60000 })
          await page.waitForFunction(() => window.__publishedGeometryAudit.completed > 0 && window.__publishedGeometryAudit.pending === 0, null, { timeout: 60000 })
          assert.deepEqual(await page.evaluate(() => window.__publishedGeometryAudit.errors), [])
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        }
        await page.screenshot({ path: resolve(values.output, `${scenario}.png`) })
        assert.deepEqual(errors, [])
        reports.push({ scenario, passed: true, errors })
        console.log(`${scenario}: passed`)
      } finally { await context.close() }
    }
  } finally { await browser.close() }
  await writeFile(resolve(values.output, 'audit.json'), JSON.stringify({ url: values.url, projectRevision: published.revision, plants: 6, reports }, null, 2) + '\n')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1 })
}
