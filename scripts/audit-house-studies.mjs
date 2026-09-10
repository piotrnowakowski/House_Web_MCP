/**
 * Brief: Verify three published projects, independent migrations, reload and mobile switching.
 * Inputs: --url (default local 5173), --output (default output/carport-study), --help; tracked project JSON; no environment variables.
 * Outputs: screenshots and audit.json. Isolated Chrome contexts only, never the user's profile.
 * Usage: node scripts/audit-house-studies.mjs --url http://127.0.0.1:5173/
 */
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'

async function savedProject(page, ref) {
  return page.evaluate(async ref => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('house-web-mcp'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    try { return await new Promise((resolve, reject) => { const r = db.transaction('projects').objectStore('projects').get('workspace/' + ref); r.onsuccess = () => resolve(r.result?.project); r.onerror = () => reject(r.error) }) } finally { db.close() }
  }, ref)
}

async function main() {
  const { values } = parseArgs({ options: { url: { type: 'string', default: 'http://127.0.0.1:5173/' }, output: { type: 'string', default: 'output/carport-study' }, help: { type: 'boolean' } } })
  if (values.help) { console.log('Usage: node scripts/audit-house-studies.mjs [--url URL] [--output DIR]'); return }
  const projects = await Promise.all(['zielonki', 'zielonki-v2', 'zielonki-rear-carport'].map(async slug => JSON.parse(await readFile('project-data/' + slug + '/project.json', 'utf8'))))
  const baselines = await Promise.all(['zielonki/before-browser-capture-r46.json', 'zielonki-v2/before-road-carport-r49.json'].map(async path => JSON.parse(await readFile('project-data/' + path, 'utf8'))))
  await mkdir(values.output, { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const reports = []
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      const existing = viewport.width === 1440
      const expected = structuredClone(projects)
      const context = await browser.newContext({ viewport, isMobile: viewport.width < 900, hasTouch: viewport.width < 900 })
      try {
        const page = await context.newPage(), errors = []
        page.setDefaultTimeout(30000)
        page.on('pageerror', e => errors.push(e.message))
        if (existing) {
          const bootstrap = new URL('migration-fixture', values.url).href
          await page.route(bootstrap, route => route.fulfill({ contentType: 'text/html', body: '<title>Isolated existing project fixture</title>' }))
          await page.goto(bootstrap)
          await page.evaluate(async baselines => {
            const db = await new Promise((resolve, reject) => { const r = indexedDB.open('house-web-mcp', 2); r.onupgradeneeded = () => r.result.createObjectStore('projects'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
            try {
              await new Promise((resolve, reject) => {
                const tx = db.transaction('projects', 'readwrite'), store = tx.objectStore('projects')
                for (const base of baselines) {
                  const local = structuredClone(base)
                  local.buildings[0].name = 'Retained independent house name'
                  local.landscape.plants.pop()
                  local.revision++
                  store.put({ version: 1, project: local, proposals: [], draftChangeSets: [] }, 'workspace/' + base.ref)
                  store.put(base, 'published-base/' + base.ref)
                }
                tx.oncomplete = resolve; tx.onerror = () => reject(tx.error)
              })
            } finally { db.close() }
          }, baselines)
          for (let i = 0; i < baselines.length; i++) {
            expected[i].buildings[0].name = 'Retained independent house name'
            const removed = baselines[i].landscape.plants.at(-1).ref
            expected[i].landscape.plants = expected[i].landscape.plants.filter(plant => plant.ref !== removed)
          }
        }
        await page.goto(values.url, { waitUntil: 'domcontentloaded', timeout: 90000 })
        const dialog = page.getByRole('dialog', { name: 'Where do you want to plan today?' })
        const openProject = async project => {
          await page.getByRole('button', { name: 'Continue · ' + project.name, exact: true }).or(page.getByRole('button', { name: 'Open · ' + project.name, exact: true })).click()
          await expect(dialog).not.toBeVisible({ timeout: 30000 })
          await expect(page.locator('.compass-label').first()).toBeVisible({ timeout: 90000 })
          const saved = await savedProject(page, project.ref)
          assert.deepEqual({ ...saved, revision: project.revision, updatedAt: project.updatedAt }, project)
          return saved
        }
        for (const project of expected) {
          const saved = await openProject(project)
          const toggle = page.getByRole('button', { name: 'Projects', exact: true })
          const box = await toggle.boundingBox()
          assert.ok(box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x + box.width <= viewport.width)
          await page.reload({ waitUntil: 'domcontentloaded' })
          assert.deepEqual(await openProject(project), saved)
          await toggle.click()
          await expect(dialog).toBeVisible()
          await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
          await page.keyboard.press('Escape')
          await expect(dialog).not.toBeVisible()
          await expect(toggle).toBeFocused()
          await toggle.click()
        }
        await page.screenshot({ path: resolve(values.output, viewport.width + '-projects.png') })
        assert.deepEqual(errors, [])
        reports.push({ viewport, existing, passed: true, projects: expected.map(({ ref, revision }) => ({ ref, revision })) })
        await writeFile(resolve(values.output, 'audit.json'), JSON.stringify({ url: values.url, reports }, null, 2) + '\n')
        console.log(viewport.width + '×' + viewport.height + ': passed (' + (existing ? 'migrated' : 'fresh') + ')')
      } catch (error) {
        const page = context.pages()[0]
        if (page) {
          console.error((await page.locator('body').innerText()).slice(-4000))
          await page.screenshot({ path: resolve(values.output, 'failure.png') })
        }
        throw error
      } finally { await context.close() }
    }
  } finally { await browser.close() }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error); process.exitCode = 1 })
