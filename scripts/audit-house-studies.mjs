/**
 * Brief: Verify house variants, independent saves, modal focus and mobile touch targets in isolated Chrome.
 * Inputs: --url (default local 5173), --output (default output/carport-study), --help; no environment variables.
 * Outputs: desktop/mobile screenshots and audit.json. Never accesses the user's browser profile.
 * Usage: node scripts/audit-house-studies.mjs --url http://127.0.0.1:5173/
 */
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'

async function savedProject(page, ref) {
  return page.evaluate(async (ref) => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('house-web-mcp'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    try { return await new Promise((resolve, reject) => { const r = db.transaction('projects').objectStore('projects').get(`workspace/${ref}`); r.onsuccess = () => resolve(r.result?.project); r.onerror = () => reject(r.error) }) } finally { db.close() }
  }, ref)
}

async function main() {
  const { values } = parseArgs({ options: { url: { type: 'string', default: 'http://127.0.0.1:5173/' }, output: { type: 'string', default: 'output/carport-study' }, help: { type: 'boolean' } } })
  if (values.help) { console.log('Usage: node scripts/audit-house-studies.mjs [--url URL] [--output DIR]'); return }
  const original = JSON.parse(await readFile('project-data/zielonki/project.json', 'utf8'))
  const variant = JSON.parse(await readFile('project-data/zielonki-v2/project.json', 'utf8'))
  const previousV2 = JSON.parse(await readFile('project-data/zielonki-v2/before-carport-r46.json', 'utf8'))
  await mkdir(values.output, { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const reports = []
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      const context = await browser.newContext({ viewport, isMobile: viewport.width < 900, hasTouch: viewport.width < 900 })
      try {
        const page = await context.newPage(), errors = []
        page.on('pageerror', e => errors.push(e.message))
        if (viewport.width === 1440) {
          const bootstrap = new URL('v2-migration-fixture', values.url).href
          await page.route(bootstrap, route => route.fulfill({ contentType: 'text/html', body: '<title>Isolated existing v2 fixture</title>' }))
          await page.goto(bootstrap)
          await page.evaluate(async project => {
            const db = await new Promise((resolve, reject) => { const r = indexedDB.open('house-web-mcp', 2); r.onupgradeneeded = () => r.result.createObjectStore('projects'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
            try { await new Promise((resolve, reject) => { const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put({ version: 1, project, proposals: [], draftChangeSets: [] }, `workspace/${project.ref}`); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error) }) } finally { db.close() }
          }, previousV2)
        }
        await page.goto(values.url, { waitUntil: 'domcontentloaded', timeout: 90000 })
        await page.getByRole('button', { name: /Zielonki house study/ }).click()
        await expect(page.locator('.compass-label').first()).toBeVisible({ timeout: 90000 })
        const toggle = page.getByRole('button', { name: 'House variants', exact: true })
        await toggle.click()
        await expect(page.getByRole('dialog', { name: 'House variants' })).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(toggle).toBeFocused()
        await toggle.click()
        await page.screenshot({ path: resolve(values.output, `${viewport.width}-chooser.png`) })
        await page.getByRole('button', { name: /zielonki v2 · South carport/ }).click()
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 30000 })
        await expect(toggle).toHaveAttribute('aria-pressed', 'true', { timeout: 30000 })
        assert.deepEqual(await savedProject(page, original.ref), original)
        const savedV2 = await savedProject(page, variant.ref)
        assert.deepEqual({ ...savedV2, revision: variant.revision, updatedAt: variant.updatedAt }, variant)
        const box = await toggle.boundingBox()
        assert.ok(box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x + box.width <= viewport.width, 'Variant button must fit and remain touch-sized')
        await page.waitForTimeout(8000)
        await page.screenshot({ path: resolve(values.output, `${viewport.width}-carport.png`) })
        if (viewport.width === 1440) {
          await page.getByRole('button', { name: 'House interior', exact: true }).click()
          await page.waitForTimeout(4000)
          await page.screenshot({ path: resolve(values.output, 'ground-floor.png') })
          // Reopening the page exercises persisted variant availability in the standard project launcher.
          await page.reload({ waitUntil: 'domcontentloaded' })
          await page.locator('.project-card').filter({ has: page.getByText('zielonki v2', { exact: true }) }).getByRole('button', { name: /Continue|Open/ }).click()
          await expect(page.locator('.compass-label').first()).toBeVisible({ timeout: 90000 })
        }
        await toggle.click()
        await page.getByRole('button', { name: /Current house/ }).click()
        await expect(toggle).toHaveAttribute('aria-pressed', 'false', { timeout: 30000 })
        await toggle.click()
        await page.getByRole('button', { name: /zielonki v2 · South carport/ }).click()
        await expect(toggle).toHaveAttribute('aria-pressed', 'true', { timeout: 30000 })
        assert.deepEqual(await savedProject(page, original.ref), original)
        assert.deepEqual(await savedProject(page, variant.ref), savedV2)
        assert.deepEqual(errors, [])
        reports.push({ viewport, passed: true, originalRevision: original.revision, variantRevision: variant.revision })
        await writeFile(resolve(values.output, 'audit.json'), JSON.stringify({ url: values.url, reports }, null, 2) + '\n')
        console.log(`${viewport.width}×${viewport.height}: passed`)
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
