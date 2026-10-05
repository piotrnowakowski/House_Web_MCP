/** Fresh and saved-r81 validation in isolated Chromium; never touches the user's profile. */
import { chromium, expect } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const url = process.argv[2] ?? 'http://127.0.0.1:5173'
const output = 'output/compact-garden'
const baseline = JSON.parse(await readFile('project-data/zielonki-rear-bath-room/before-compact-garden-r81.json', 'utf8'))
const canonical = JSON.parse(await readFile('project-data/zielonki-rear-bath-room/project.json', 'utf8'))
const removed = baseline.landscape.fixtures.filter(old => !canonical.landscape.fixtures.some(f => f.ref === old.ref)).map(f => f.ref)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] })
const report = []
try {
  for (const existing of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1.5 })
    await context.addInitScript(() => { localStorage.setItem('render-quality', 'detailed'); performance.setResourceTimingBufferSize(10000) })
    const page = await context.newPage(), errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    if (existing) {
      await page.route('**/compact-garden-fixture', route => route.fulfill({ contentType: 'text/html', body: '<title>Isolated r81 fixture</title>' }))
      await page.goto(url + '/compact-garden-fixture')
      await page.evaluate(async project => {
        const db = await new Promise((resolve, reject) => { const r = indexedDB.open('house-web-mcp', 2); r.onupgradeneeded = () => r.result.createObjectStore('projects'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
        await new Promise((resolve, reject) => {
          const tx = db.transaction('projects', 'readwrite'), store = tx.objectStore('projects'), copy = structuredClone(project)
          copy.buildings[0].spaces[0].name = 'Independent room edit'
          copy.landscape.plants = copy.landscape.plants.filter(p => p.ref !== 'plant/kitchen-garden/apple-1')
          store.put(project, `published-base/${project.ref}`)
          store.put({ version: 1, project: copy, proposals: [], draftChangeSets: [] }, `workspace/${project.ref}`)
          tx.oncomplete = resolve; tx.onerror = () => reject(tx.error)
        })
        db.close()
      }, baseline)
    }
    const open = async () => {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
      await page.evaluate(async ref => {
        const source = performance.getEntriesByType('resource').filter(r => /\/src\/state\/store\.ts(?:\?|$)/.test(r.name)).at(-1).name
        const { useStudioStore } = await import(source)
        window.__compactStore = useStudioStore
        await useStudioStore.getState().openWorkspace(ref)
      }, canonical.ref)
      await expect.poll(() => page.evaluate(() => !window.__compactStore.getState().launcherOpen)).toBe(true)
    }
    await open()
    const project = await page.evaluate(() => window.__compactStore.getState().project)
    assert(project.revision >= 82)
    assert.equal(project.landscape.fixtures.filter(f => f.catalogId.startsWith('larch-bed')).length, 6)
    assert(!removed.some(ref => project.landscape.fixtures.some(f => f.ref === ref)))
    if (existing) {
      assert.equal(project.buildings[0].spaces[0].name, 'Independent room edit')
      assert(!project.landscape.plants.some(p => p.ref === 'plant/kitchen-garden/apple-1'))
    }
    if (!existing) {
      await expect.poll(() => page.evaluate(async () => {
        const source = performance.getEntriesByType('resource').filter(r => r.name.includes('/@react-three_fiber.js')).at(-1)?.name
        if (!source) return false
        const { _roots } = await import(source), root = [..._roots.values()][0]?.store.getState()
        let found = false
        root?.scene.traverse(o => { if (o.userData.semanticRef === 'fixture/kitchen-garden/bed-nw1') found = true })
        if (found && root?.controls) { window.__compactRoot = root; return true }
        return false
      }), { timeout: 60000 }).toBe(true)
      for (const [name, eye, target, trees] of [
        ['six-beds-overview', [20.8, 14.5, 8.4], [13.6, 0.4, -2.4], false],
        ['six-beds-plan', [13.6, 20, -2.3], [13.6, 0, -2.4], false],
        ['garden-entrance', [13.6, 3.8, 7], [13.6, 1.0, -3.2], false],
        ['existing-trees-check', [20.8, 14.5, 8.4], [13.6, 0.4, -2.4], true],
      ]) {
        await page.evaluate(({ eye, target, trees }) => {
          const root = window.__compactRoot
          window.__compactStore.getState().setTreesVisible(trees)
          root.camera.clearViewOffset(); root.controls.setFocalOffset(0, 0, 0, false)
          root.controls.setLookAt(...eye, ...target, false); root.controls.zoomTo(1, false); root.invalidate()
        }, { eye, target, trees })
        await page.waitForTimeout(1800)
        await page.locator('canvas').first().screenshot({ path: `${output}/${name}.png` })
      }
    }
    await open()
    const reloaded = await page.evaluate(() => window.__compactStore.getState().project)
    assert.equal(reloaded.landscape.fixtures.filter(f => f.catalogId.startsWith('larch-bed')).length, 6)
    assert(!removed.some(ref => reloaded.landscape.fixtures.some(f => f.ref === ref)))
    assert.deepEqual(reloaded, project)
    assert.deepEqual(errors, [])
    report.push({ existingR81: existing, revision: project.revision, beds: 6, deletedRefsStayDeleted: true, savedReloadMatches: true, independentEditsRetained: existing, errors })
    await writeFile(`${output}/audit.json`, JSON.stringify(report, null, 2) + '\n')
    console.log(existing ? 'Saved r81 -> compact garden and reload passed' : 'Fresh six-bed garden, screenshots and reload passed')
    await context.close()
  }
} finally { await browser.close() }
