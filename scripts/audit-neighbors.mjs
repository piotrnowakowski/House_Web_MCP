/**
 * Brief: Check optional neighbor context, facade viewpoints, reload and mobile layout in isolated Chrome.
 * Inputs: --url (default http://127.0.0.1:5173/), --output (default output/neighbors), --help. No env vars.
 * Files: canonical project-data/zielonki/project.json; uses fresh browser profiles, never the user's profile.
 * Outputs: screenshots and audit.json. Local Vite runs also inspect the rendered scene and camera.
 * Usage from repository root: node scripts/audit-neighbors.mjs --url http://127.0.0.1:5173/
 */
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

async function sceneState(page) {
  return page.evaluate(async () => {
    const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js')
    const root = [..._roots.values()][0]?.store.getState()
    const neighbors = root?.scene.getObjectByName('neighbor-buildings')
    return { count: neighbors?.children.length ?? 0, camera: root?.camera.position.toArray(), shadows: neighbors?.children.every((group) => group.children.every((mesh) => mesh.castShadow)), drawing: root?.gl.info.render.calls ?? 0 }
  })
}

async function main() {
  const { values } = parseArgs({ options: { url: { type: 'string', default: 'http://127.0.0.1:5173/' }, output: { type: 'string', default: 'output/neighbors' }, help: { type: 'boolean' } } })
  if (values.help) { console.log('Usage: node scripts/audit-neighbors.mjs [--url URL] [--output DIR]'); return }
  const published = JSON.parse(await readFile('project-data/zielonki/project.json', 'utf8'))
  const inspectScene = new URL(values.url).port === '5173'
  await mkdir(values.output, { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const reports = []
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      const compact = viewport.width <= 900
      const context = await browser.newContext({ viewport, isMobile: compact, hasTouch: compact })
      try {
        const page = await context.newPage(), errors = []
        page.on('pageerror', (e) => errors.push(e.message))
        await page.goto(values.url, { waitUntil: 'domcontentloaded', timeout: 90000 })
        await page.getByRole('button', { name: /Zielonki house study/ }).click()
        await expect(page.locator('.compass-label').first()).toBeVisible({ timeout: 90000 })
        const toggle = page.getByRole('button', { name: 'Neighbor buildings', exact: true })
        await expect(toggle).toHaveAttribute('aria-pressed', 'false')
        if (inspectScene) await expect.poll(async () => (await sceneState(page)).drawing, { timeout: 60000 }).toBeGreaterThan(0)
        const before = inspectScene ? await sceneState(page) : null
        await toggle.click()
        await expect(toggle).toHaveAttribute('aria-pressed', 'true')
        if (inspectScene) {
          await expect.poll(async () => (await sceneState(page)).count).toBe(8)
          const after = await sceneState(page)
          assert.equal(after.shadows, true)
          assert.deepEqual(after.camera, before.camera, 'Toggling the layer must preserve the camera')
        }
        await page.getByRole('button', { name: compact ? 'More' : 'Neighbor view settings', exact: true }).click()
        await expect(page.getByRole('region', { name: 'Neighbor view settings' })).toContainText('window positions are unknown')
        await page.getByRole('combobox', { name: 'Neighbor viewpoint', exact: true }).selectOption('neighbor/34-5')
        await page.getByRole('combobox', { name: 'Neighbor eye height', exact: true }).selectOption('4.6')
        await page.getByRole('button', { name: 'View towards our house', exact: true }).click()
        await page.waitForTimeout(2000)
        if (inspectScene) assert.ok(Math.abs((await sceneState(page)).camera[1] - 4.9) < 0.01)
        await page.screenshot({ path: resolve(values.output, `${viewport.width}-viewpoint.png`) })
        await page.getByRole('button', { name: compact ? 'Fit plot view' : 'Refocus on Main house', exact: true }).click()
        await page.waitForTimeout(1800)
        await toggle.click()
        if (inspectScene) await expect.poll(async () => (await sceneState(page)).count).toBe(0)
        await toggle.click()
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
        await page.getByRole('button', { name: /Zielonki house study/ }).click()
        await expect(page.locator('.compass-label').first()).toBeVisible({ timeout: 90000 })
        await expect(toggle).toHaveAttribute('aria-pressed', 'true')
        const saved = await page.evaluate(async () => {
          const db = await new Promise((resolve, reject) => { const r = indexedDB.open('house-web-mcp'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
          try { return await new Promise((resolve, reject) => { const r = db.transaction('projects').objectStore('projects').get('workspace/project/zielonki-spatial-v2'); r.onsuccess = () => resolve(r.result?.project); r.onerror = () => reject(r.error) }) } finally { db.close() }
        })
        assert.equal(saved.site.northDegrees, published.site.northDegrees)
        assert.deepEqual(saved.site.neighbors, published.site.neighbors)
        assert.deepEqual(saved.buildings, published.buildings)
        assert.equal(saved.landscape.plants.length, 6)
        const box = await toggle.boundingBox()
        assert.ok(box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x + box.width <= viewport.width)
        await page.waitForTimeout(4000)
        await page.screenshot({ path: resolve(values.output, `${viewport.width}-layer.png`) })
        assert.deepEqual(errors, [])
        reports.push({ viewport, result: 'passed', projectRevision: saved.revision, neighbors: saved.site.neighbors.length })
        await writeFile(resolve(values.output, 'audit.json'), JSON.stringify({ url: values.url, reports }, null, 2) + '\n')
        console.log(`${viewport.width}x${viewport.height}: passed`)
      } finally { await context.close() }
    }
  } finally { await browser.close() }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error); process.exitCode = 1 })
