/**
 * Brief: Verify precision controls in isolated desktop/mobile Chrome profiles.
 * Inputs: --url preview/deployment URL, --output evidence directory, --help.
 * Outputs: screenshots and audit.json; disposable test project edits only.
 * Usage: node scripts/audit-precision-editor.mjs --url http://127.0.0.1:5173/
 */
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'

async function stored(page, ref) {
  return page.evaluate(async ref => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('house-web-mcp'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    try {
      return await new Promise((resolve, reject) => {
        const r = db.transaction('projects').objectStore('projects').get(`workspace/${ref}`)
        r.onsuccess = () => resolve(r.result?.project); r.onerror = () => reject(r.error)
      })
    } finally { db.close() }
  }, ref)
}

async function main() {
  const { values } = parseArgs({ options: {
    url: { type: 'string', default: 'http://127.0.0.1:5173/' },
    output: { type: 'string', default: 'output/precision-editor' }, help: { type: 'boolean' },
  } })
  if (values.help) { console.log('Usage: node scripts/audit-precision-editor.mjs [--url URL] [--output DIR]'); return }
  const initial = JSON.parse(await readFile('project-data/zielonki-v2/project.json', 'utf8')), b = initial.buildings[0]
  const wall = b.walls.find(w => w.start.z === 5.575 && w.end.z === 5.575)
  const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
  const openingWall = b.walls.find(w => w.openings.some(o => o.kind === 'window' && o.offsetM + o.widthM / 2 < Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z) - .1))
  const opening = openingWall.openings.find(o => o.kind === 'window')
  const item = b.furniture.find(i => i.ref === 'interior/reference-sofa')
  await mkdir(values.output, { recursive: true }); const reports = []
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const width of [1440, 390]) {
      const mobile = width < 900
      const context = await browser.newContext({ viewport: { width, height: mobile ? 844 : 1000 }, isMobile: mobile, hasTouch: mobile })
      const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message))
      try {
        await page.goto(values.url, { waitUntil: 'domcontentloaded', timeout: 90000 })
        await page.getByRole('button', { name: /Zielonki house study/ }).click()
        await expect(page.locator('.compass-label').first()).toBeVisible({ timeout: 90000 })
        await page.getByRole('button', { name: 'House variants', exact: true }).click()
        await page.getByRole('button', { name: /zielonki v2 · Carport/ }).click()
        await expect(page.getByRole('button', { name: 'House variants', exact: true })).toHaveAttribute('aria-pressed', 'true', { timeout: 30000 })
        if (mobile) await page.getByRole('navigation', { name: 'Plot actions' }).getByRole('button', { name: 'Edit', exact: true }).click()
        const editor = page.getByRole('region', { name: 'Precision editor' }), choose = editor.getByLabel('Choose element to edit')
        const waitForValue = get => expect.poll(async () => get(await stored(page, initial.ref)), { timeout: 20000 })
        await choose.selectOption(b.ref)
        await editor.getByLabel('Position X (m)', { exact: true }).fill(String(b.position.x + .1))
        await editor.getByRole('button', { name: 'Apply position', exact: true }).click()
        await waitForValue(p => p?.buildings[0].position.x).toBeCloseTo(b.position.x + .1)
        let saved = await stored(page, initial.ref)
        assert.ok(Math.abs(saved.buildings[1].position.x - (initial.buildings[1].position.x + .1)) < 1e-6)
        await editor.getByRole('button', { name: 'Undo edit', exact: true }).click()
        await waitForValue(p => p?.buildings[0].position.x).toBeCloseTo(b.position.x)
        await editor.getByRole('button', { name: 'Redo edit', exact: true }).click()
        await waitForValue(p => p?.buildings[0].position.x).toBeCloseTo(b.position.x + .1)
        await editor.getByLabel('Position X (m)', { exact: true }).fill('999')
        await editor.getByRole('button', { name: 'Cancel adjustment' }).click()
        await expect(editor.getByLabel('Position X (m)', { exact: true })).toHaveValue(String(b.position.x + .1))
        await choose.selectOption(opening.ref)
        await editor.getByLabel('Distance from wall start (m)', { exact: true }).fill(String(opening.offsetM + .01))
        await editor.getByRole('button', { name: 'Save opening', exact: true }).click()
        await waitForValue(p => p?.buildings[0].walls.find(w => w.ref === openingWall.ref).openings.find(o => o.ref === opening.ref).offsetM).toBeCloseTo(opening.offsetM + .01)
        await choose.selectOption(wall.ref)
        await editor.getByLabel('Wall length anchor').selectOption('end')
        await editor.getByLabel('Wall length (m)', { exact: true }).fill(String(length - .1))
        await editor.getByRole('button', { name: 'Move connected wall', exact: true }).click()
        await waitForValue(p => { const w = p?.buildings[0].walls.find(w => w.ref === wall.ref); return w ? Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z) : 0 }).toBeCloseTo(length - .1)
        await page.screenshot({ path: `${values.output}/${width}-wall.png` })
        await choose.selectOption(item.ref)
        await editor.getByLabel('Position X (m)', { exact: true }).fill(String(item.position.x + .01))
        await editor.getByRole('button', { name: 'Apply changes', exact: true }).click()
        await waitForValue(p => p?.buildings[0].furniture.find(i => i.ref === item.ref).position.x).toBeCloseTo(item.position.x + .01)
        await editor.getByRole('button', { name: 'Measure distance', exact: true }).click()
        await editor.getByRole('button', { name: 'Enter two points' }).click()
        await editor.getByLabel('Point 2 X (m)', { exact: true }).fill('3')
        await editor.getByLabel('Point 2 Z (m)', { exact: true }).fill('4')
        await editor.getByRole('button', { name: 'Apply endpoints' }).click()
        await expect(editor.getByLabel('Exact distance result')).toContainText('5.000 m')
        await page.screenshot({ path: `${values.output}/${width}-measure.png` })
        saved = await stored(page, initial.ref)
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.locator('.project-card').filter({ has: page.getByText('zielonki v2', { exact: true }) }).getByRole('button', { name: /Continue|Open/ }).click()
        await expect(page.locator('.compass-label').first()).toBeVisible({ timeout: 90000 })
        assert.deepEqual(await stored(page, initial.ref), saved)
        assert.deepEqual(errors, [])
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow')
        reports.push({ width, passed: true, checks: ['building and linked carport', 'undo/redo', 'cancel', 'opening move', 'connected wall shortening', 'furniture move', '5 m exact measurement', 'reload'] })
        await writeFile(`${values.output}/audit.json`, JSON.stringify({ url: values.url, reports }, null, 2))
        console.log(`${width}: passed`)
      } catch (e) {
        await page.screenshot({ path: `${values.output}/failure-${width}.png` })
        console.error((await page.locator('body').innerText()).slice(0, 4500)); throw e
      } finally { await context.close() }
    }
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
