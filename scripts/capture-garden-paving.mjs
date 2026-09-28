/** Renderer-only paving inspection in an isolated browser, without editing project data. */
import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const output = process.argv[2] ?? 'output/garden-paving'
const url = process.argv[3] ?? 'http://127.0.0.1:5173'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] })
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 1.5 })
  await context.addInitScript(() => { localStorage.setItem('render-quality', 'detailed'); performance.setResourceTimingBufferSize(10000) })
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
  await page.evaluate(async () => {
    const storeUrl = performance.getEntriesByType('resource').filter(r => /\/src\/state\/store\.ts(?:\?|$)/.test(r.name)).at(-1).name
    const { useStudioStore } = await import(storeUrl)
    await useStudioStore.getState().openWorkspace('project/zielonki-rear-bath-room')
    window.__pavingStore = useStudioStore
  })
  await expect.poll(() => page.evaluate(async () => {
    const source = performance.getEntriesByType('resource').filter(r => r.name.includes('/@react-three_fiber.js')).at(-1)?.name
    if (!source) return false
    const { _roots } = await import(source), root = [..._roots.values()][0]?.store.getState()
    let found = false
    root?.scene.traverse(o => { if (o.userData.semanticRef === 'fixture/fire-lounge/sunken-court') found = true })
    if (found && root?.controls) { window.__pavingRoot = root; return true }
    return false
  }), { timeout: 60000 }).toBe(true).catch(async error => {
    await page.screenshot({ path: `${output}/failure.png` })
    console.error('Scene unavailable', errors, await page.evaluate(() => ({
      project: window.__pavingStore?.getState().project.ref,
      launcher: window.__pavingStore?.getState().launcherOpen,
      text: document.body.innerText.slice(-1800),
      modules: performance.getEntriesByType('resource').filter(r => /fiber|\/src\/state\/store/.test(r.name)).map(r => r.name),
    })))
    throw error
  })
  const before = await page.evaluate(() => JSON.stringify(window.__pavingStore.getState().project))
  for (const [name, eye, target] of [
    ['garden-path', [15.2, 3.5, 18], [14.4, 1.2, -3]],
    ['overview', [21, 8, 47.5], [10.4, 0.2, 37.5]],
    ['paving-detail', [6.9, 1.5, 32.2], [8.7, -0.05, 34.4]],
    ['sunken-floor', [8.6, 1.4, 35.0], [10.7, -0.45, 38]],
  ]) {
    await page.evaluate(({ eye, target }) => {
      const root = window.__pavingRoot
      root.camera.clearViewOffset(); root.controls.setFocalOffset(0, 0, 0, false)
      root.controls.setLookAt(...eye, ...target, false); root.controls.zoomTo(1, false); root.invalidate()
    }, { eye, target })
    await page.waitForTimeout(2000)
    await page.locator('canvas').first().screenshot({ path: `${output}/${name}.png` })
  }
  const after = await page.evaluate(() => JSON.stringify(window.__pavingStore.getState().project))
  assert.equal(after, before, 'Rendering must not mutate the saved house project')
  assert.deepEqual(errors, [])
  await writeFile(`${output}/inspection.json`, JSON.stringify({ revision: JSON.parse(after).revision, projectUnchanged: true, errors }, null, 2) + '\n')
  console.log(`Paving captured: ${output}; project unchanged; no browser errors`)
} finally { await browser.close() }
