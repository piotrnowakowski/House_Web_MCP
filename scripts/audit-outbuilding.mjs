/**
 * Brief: Verify the outbuilding in fresh and existing isolated Chrome workspaces.
 * Inputs: --url development server (default http://localhost:5173/), --output directory,
 * --help. Reads the preserved v2 r53 baseline. No environment variables.
 * Outputs: audit.json and desktop screenshots; never accesses the user's profile.
 * Usage: node scripts/audit-outbuilding.mjs --output output/outbuilding-audit
 */
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'

async function readProject(page) {
  return page.evaluate(async () => {
    const { loadWorkspace } = await import('/src/services/persistence.ts')
    return (await loadWorkspace('project/zielonki-v2')).project
  })
}

async function main() {
  const { values } = parseArgs({ options: { url: { type: 'string', default: 'http://localhost:5173/' }, output: { type: 'string', default: 'output/outbuilding-audit' }, help: { type: 'boolean' } } })
  if (values.help) { console.log('Usage: node scripts/audit-outbuilding.mjs [--url URL] [--output DIR]'); return }
  await mkdir(values.output, { recursive: true })
  const baseline = JSON.parse(await readFile('project-data/zielonki-v2/before-wide-site-outbuilding-r53.json', 'utf8'))
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const report = []
  try {
    for (const existing of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
      try {
        const page = await context.newPage(), errors = []
        page.on('pageerror', error => errors.push(error.message))
        if (existing) {
          const bootstrap = new URL('outbuilding-fixture', values.url).href
          await page.route(bootstrap, route => route.fulfill({ contentType: 'text/html', body: '<title>Isolated v2 migration fixture</title>' }))
          await page.goto(bootstrap)
          await page.evaluate(async project => {
            const db = await new Promise((resolve, reject) => { const r = indexedDB.open('house-web-mcp', 2); r.onupgradeneeded = () => r.result.createObjectStore('projects'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
            await new Promise((resolve, reject) => {
              const tx = db.transaction('projects', 'readwrite'), store = tx.objectStore('projects')
              store.put(project, `published-base/${project.ref}`)
              const local = structuredClone(project)
              local.buildings[1].furniture.pop()
              local.buildings[0].spaces[0].name = 'Retained browser room'
              store.put({ version: 1, project: local, proposals: [], draftChangeSets: [] }, `workspace/${project.ref}`)
              tx.oncomplete = resolve; tx.onerror = () => reject(tx.error)
            })
            db.close()
          }, baseline)
        }
        await page.goto(values.url, { waitUntil: 'domcontentloaded' })
        if (existing) await page.locator('.project-card').filter({ has: page.getByText('zielonki v2', { exact: true }) }).getByRole('button', { name: /^(Continue · zielonki v2|Open)$/ }).click()
        else {
          await page.getByRole('button', { name: /Zielonki house study/ }).click()
          await page.getByRole('button', { name: 'House variants', exact: true }).click()
          await page.getByRole('button', { name: /zielonki v2 · Carport/ }).click()
        }
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 30000 })
        await expect.poll(async () => (await readProject(page)).buildings.length, { timeout: 30000 }).toBe(3)
        const saved = await readProject(page)
        assert.equal(saved.buildings[2].designStatus, 'concept')
        assert.equal(saved.buildings[2].rotationDegrees, 90)
        assert.equal(saved.buildings[2].position.z, 54.8)
        assert.equal(saved.buildings[2].roof.type, 'gable')
        assert.equal(saved.buildings[2].roof.pitchDegrees, 37)
        assert(saved.buildings[2].furniture.some(i => i.ref === 'interior/outbuilding/car'))
        assert.equal(saved.buildings[2].spaces.length, 4)
        assert.equal(saved.landscape.fixtures.filter(f => f.ref.startsWith('fixture/outbuilding/')).length, 5)
        if (existing) {
          assert.equal(saved.buildings[1].furniture.length, 1)
          assert.equal(saved.buildings[0].spaces[0].name, 'Retained browser room')
        }
        await page.waitForFunction(async () => {
          const url = performance.getEntriesByType('resource').find(e => e.name.includes('/@react-three_fiber.js'))?.name
          if (!url) return false
          const { _roots } = await import(url)
          const root = [..._roots.values()][0]?.store.getState()
          let walls = 0
          root?.scene.traverse(o => { if (o.userData?.semanticRef?.startsWith('wall/outbuilding/')) walls++ })
          const controls = root?.controls
          if (walls <= 5 || !controls) return false
          root.camera.clearViewOffset()
          controls.setFocalOffset(0, 0, 0, false)
          controls.setLookAt(-31, 22, 27, -7, 1, 53, false)
          controls.zoomTo(1.05, false)
          return true
        }, null, { timeout: 60000 })
        await page.waitForTimeout(1800)
        await page.screenshot({ path: resolve(values.output, existing ? 'existing.png' : 'fresh.png') })
        await page.evaluate(async () => {
          const url = performance.getEntriesByType('resource').filter(e => e.name.includes('/src/state/store.ts')).at(-1).name
          const { useStudioStore } = await import(url)
          useStudioStore.getState().commitCommand({ type: 'garden-fixture.update', action: 'remove', fixtureRef: 'fixture/outbuilding/spa' })
        })
        await expect.poll(async () => (await readProject(page)).landscape.fixtures.some(f => f.ref === 'fixture/outbuilding/spa'), { timeout: 30000 }).toBe(false)
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.getByRole('button', { name: 'Continue · zielonki v2', exact: true }).click()
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 30000 })
        assert.equal((await readProject(page)).landscape.fixtures.some(f => f.ref === 'fixture/outbuilding/spa'), false)
        assert.deepEqual(errors, [])
        report.push({ existing, passed: true, projectRef: saved.ref, revision: saved.revision, buildings: 3, jacuzziDeletionSurvivesReload: true })
        await writeFile(resolve(values.output, 'audit.json'), JSON.stringify(report, null, 2) + '\n')
        console.log(`${existing ? 'Existing' : 'Fresh'} browser: passed`)
      } catch (error) {
        const page = context.pages()[0]
        if (page) {
          const saved = await readProject(page).catch(() => null)
          console.error(JSON.stringify({ existing, savedBuildings: saved?.buildings.map(b => b.ref), body: (await page.locator('body').innerText()).slice(-2500) }))
          await page.screenshot({ path: resolve(values.output, 'failure.png') })
        }
        throw error
      } finally { await context.close() }
    }
  } finally { await browser.close() }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error); process.exitCode = 1 })
