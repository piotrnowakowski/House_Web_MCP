/** Isolated Chromium validation; never opens or edits the user's browser profile.
 * Usage: node scripts/audit-integrated-garden.mjs [http://127.0.0.1:5173]
 * Writes screenshots plus persistence/scene assertions to output/integrated-garden/.
 */
import { chromium, expect } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const url = process.argv[2] ?? 'http://127.0.0.1:5173'
const output = 'output/integrated-garden'
const base = JSON.parse(await readFile('project-data/zielonki-rear-bath-room/before-integrated-garden-r80.json', 'utf8'))
const ref = base.ref
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] })
const report = []
try {
  for (const existing of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 1.5 })
    const page = await context.newPage(), errors = []
    page.on('pageerror', e => { errors.push(e.message); console.error('BROWSER', e.message) })
    await context.addInitScript(() => { localStorage.setItem('render-quality', 'detailed'); performance.setResourceTimingBufferSize(10000) })
    if (existing) {
      await page.route('**/garden-migration-fixture', route => route.fulfill({ contentType: 'text/html', body: '<title>Isolated garden migration fixture</title>' }))
      await page.goto(url + '/garden-migration-fixture')
      await page.evaluate(async project => {
        const db = await new Promise((resolve, reject) => { const r = indexedDB.open('house-web-mcp', 2); r.onupgradeneeded = () => r.result.createObjectStore('projects'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
        await new Promise((resolve, reject) => {
          const tx = db.transaction('projects', 'readwrite'), store = tx.objectStore('projects'), copy = structuredClone(project)
          copy.buildings[0].spaces[0].name = 'Independent room name'
          copy.landscape.plants = copy.landscape.plants.filter(p => p.ref !== 'plant/kitchen-garden/apple-1')
          store.put(project, `published-base/${project.ref}`)
          store.put({ version: 1, project: copy, proposals: [], draftChangeSets: [] }, `workspace/${project.ref}`)
          tx.oncomplete = resolve; tx.onerror = () => reject(tx.error)
        })
        db.close()
      }, base)
    }
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
    await page.evaluate(() => { window.__gardenStoreUrl = performance.getEntriesByType('resource').filter(r => /\/src\/state\/store\.ts(?:\?|$)/.test(r.name)).at(-1)?.name; if (!window.__gardenStoreUrl) throw new Error('Active app store module not loaded') })
    await page.evaluate(async ref => { const { useStudioStore } = await import(window.__gardenStoreUrl); await useStudioStore.getState().openWorkspace(ref) }, ref)
    await expect.poll(() => page.evaluate(async ref => { const { useStudioStore } = await import(window.__gardenStoreUrl); return useStudioStore.getState().project.ref === ref && !useStudioStore.getState().launcherOpen }, ref)).toBe(true)
    await expect.poll(() => page.evaluate(async () => {
      const source = performance.getEntriesByType('resource').filter(r => r.name.includes('/@react-three_fiber.js')).at(-1)?.name
      if (!source) return false
      const { _roots } = await import(source), root = [..._roots.values()][0]?.store.getState()
      let found = false
      root?.scene.traverse(o => { if (o.userData.semanticRef === 'fixture/fire-lounge/sunken-court') found = true })
      if (found && root?.controls) { window.__gardenAuditRoot = root; return true }
      return false
    }), { timeout: 60000 }).toBe(true).catch(async error => { await page.screenshot({ path: `${output}/failure.png` }); console.log('Scene wait failed', await page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(-2200), resources: performance.getEntriesByType('resource').filter(r => r.name.includes('fiber')).map(r => r.name) }))); throw error })
    await page.getByText('MPZP', { exact: true }).click()
    await expect.poll(() => page.evaluate(async () => { const { useStudioStore } = await import(window.__gardenStoreUrl); return useStudioStore.getState().planningOverlayVisible })).toBe(true)
    await page.getByText('MPZP', { exact: true }).click()
    await expect.poll(() => page.evaluate(async () => { const { useStudioStore } = await import(window.__gardenStoreUrl); return useStudioStore.getState().planningOverlayVisible })).toBe(false)
    const project = await page.evaluate(async () => { const { useStudioStore } = await import(window.__gardenStoreUrl); return useStudioStore.getState().project })
    assert(project.revision >= 81)
    assert.equal(project.landscape.fixtures.find(f => f.catalogId === 'greenhouse').position.z, -6.3)
    if (existing) {
      assert.equal(project.buildings[0].spaces[0].name, 'Independent room name')
      assert(!project.landscape.plants.some(p => p.ref === 'plant/kitchen-garden/apple-1'))
    }
    if (!existing) {
      for (const [name, eye, target] of [
        ['garden-overview', [30, 19, 27], [13.8, 0.7, 4.5]],
        ['garden-human', [15.2, 3.5, 18], [14.4, 1.2, -3]],
        ['fire-lounge', [21, 8, 47.5], [10.4, 0.2, 37.5]],
        ['fire-lounge-human', [6.6, 2.2, 33.5], [10.8, 0.3, 37.5]],
        ['site-layout', [57, 60, 69], [3, 0, 17]],
      ]) {
        await page.evaluate(async ({ eye, target }) => {
          const root = window.__gardenAuditRoot
          root.camera.clearViewOffset(); root.controls.setFocalOffset(0, 0, 0, false)
          root.controls.setLookAt(...eye, ...target, false); root.controls.zoomTo(1, false); root.invalidate()
        }, { eye, target })
        await page.waitForTimeout(1600)
        await page.locator('canvas').first().screenshot({ path: `${output}/${name}.png` })
      }
    }
    await page.evaluate(async () => {
      const { useStudioStore } = await import(window.__gardenStoreUrl)
      useStudioStore.getState().commitCommand({ type: 'garden-fixture.update', action: 'remove', fixtureRef: 'fixture/fire-lounge/sunken-court' })
    })
    await expect.poll(async () => page.evaluate(async ref => {
      const { loadWorkspace } = await import('/src/services/persistence.ts')
      return (await loadWorkspace(ref))?.project.landscape.fixtures.some(f => f.catalogId === 'sunken-fire-lounge')
    }, ref)).toBe(false)
    await page.reload({ waitUntil: 'networkidle' })
    await page.evaluate(() => { window.__gardenStoreUrl = performance.getEntriesByType('resource').filter(r => /\/src\/state\/store\.ts(?:\?|$)/.test(r.name)).at(-1)?.name })
    await page.evaluate(async ref => { const { useStudioStore } = await import(window.__gardenStoreUrl); await useStudioStore.getState().openWorkspace(ref) }, ref)
    const absent = await page.evaluate(async () => { const { useStudioStore } = await import(window.__gardenStoreUrl); return !useStudioStore.getState().project.landscape.fixtures.some(f => f.catalogId === 'sunken-fire-lounge') })
    assert(absent)
    assert.deepEqual(errors, [])
    report.push({ existing, revision: project.revision, independentEditsRetained: existing, courtDeletionSurvivesReload: true, consoleErrors: errors })
    await writeFile(`${output}/audit.json`, JSON.stringify(report, null, 2) + '\n')
    console.log(existing ? 'Existing r80 migration and reload: passed' : 'Fresh r81 rendering and deletion/reload: passed')
    await context.close()
  }
} finally { await browser.close() }
