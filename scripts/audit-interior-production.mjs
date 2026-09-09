/**
 * Brief: Audit nested deployment asset paths and the production interior in desktop/mobile Chrome.
 * Inputs: --url (default http://127.0.0.1:5189/House_Web_MCP/), --output (default output/interior-editor).
 * Outputs: JSON asset/UI/performance evidence; isolated browser contexts only. No environment variables.
 * Usage: node scripts/audit-interior-production.mjs --url http://127.0.0.1:5189/House_Web_MCP/
 */
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

async function main() {
  const { values } = parseArgs({
    options: {
      url: { type: 'string', default: 'http://127.0.0.1:5189/House_Web_MCP/' },
      output: { type: 'string', default: 'output/interior-editor' },
      help: { type: 'boolean' },
    },
  })
  if (values.help) {
    console.log('Usage: node scripts/audit-interior-production.mjs [--url URL] [--output DIR]')
    return
  }
  await mkdir(values.output, { recursive: true })
  const products = JSON.parse(await readFile('src/domain/ikea-products.json', 'utf8'))
  const assets = []
  for (const product of products)
    for (const path of [product.model, product.mobileModel, product.thumbnail]) {
      const url = new URL(path, values.url).href
      const response = await fetch(url)
      assert.equal(response.status, 200, url)
      const buffer = Buffer.from(await response.arrayBuffer())
      assert.ok(
        path.endsWith('.glb') ? buffer.readUInt32LE(0) === 0x46546c67 : buffer.subarray(1, 4).toString() === 'PNG',
        url,
      )
      assets.push({ url, bytes: buffer.length, status: response.status })
    }
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  console.log(`Verified ${assets.length} nested asset URLs`)
  const reports = []
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
        isMobile: mobile,
        hasTouch: mobile,
      })
      const page = await context.newPage(),
        errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      const modelRequests = []
      page.on('response', (response) => {
        if (response.url().includes('/models/interior/') && response.url().endsWith('.glb'))
          modelRequests.push({ url: response.url(), status: response.status() })
      })
      await page.goto(values.url)
      await page.getByRole('button', { name: /Zielonki house study/ }).click()
      await page.getByRole('button', { name: 'House interior', exact: true }).click()
      await page.getByRole('button', { name: 'More', exact: true }).click()
      const download = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Export project JSON', exact: true }).click()
      const project = JSON.parse(await readFile(await (await download).path(), 'utf8'))
      const building = project.buildings[0]
      const item = building.furniture.find((item) => item.widthM >= 0.9 && item.depthM >= 0.55)
      const product = products.find((product) => product.id === 'lack')
      assert.ok(item, 'Furnished study has a placement for the production GLB smoke test')
      Object.assign(item, {
        productId: product.id,
        variantId: product.articleNumber,
        catalogId: product.catalogId,
        name: 'LACK production check',
        widthM: product.size[0],
        depthM: product.size[1],
        heightM: product.size[2],
        color: product.color,
        elevationM: 0,
      })
      const loadedModel = page.waitForResponse(
        (response) => response.url().endsWith(mobile ? 'lack-mobile.glb' : 'lack.glb') && response.status() === 200,
      )
      await page
        .getByLabel('Import interior project file')
        .setInputFiles({
          name: 'production-audit.json',
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(project)),
        })
      await page.getByRole('button', { name: 'Close panel', exact: true }).click()
      await loadedModel
      await page.waitForTimeout(2000)
      assert.equal(await page.getByRole('button', { name: /Model unavailable/ }).count(), 0)
      const performance = await page.evaluate(async () => {
        const canvas = document.querySelector('canvas'),
          gl = canvas.getContext('webgl2'),
          debug = gl?.getExtension('WEBGL_debug_renderer_info')
        const samples = []
        let previous = performance.now()
        await new Promise((resolve) => {
          const frame = (now) => {
            samples.push(now - previous)
            previous = now
            if (samples.length < 300) requestAnimationFrame(frame)
            else resolve()
          }
          requestAnimationFrame(frame)
        })
        samples.shift()
        samples.sort((a, b) => a - b)
        return {
          renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable',
          frames: samples.length,
          medianMs: samples[Math.floor(samples.length / 2)],
          p95Ms: samples[Math.floor(samples.length * 0.95)],
          meanFps: 1000 / (samples.reduce((a, b) => a + b) / samples.length),
        }
      })
      reports.push({
        mobileViewport: mobile,
        userAgent: await page.evaluate(() => navigator.userAgent),
        furnitureCount: building.furniture.filter((i) => i.storeyRef === building.storeys[0].ref).length,
        modelRequests,
        errors,
        performance,
        limitation: 'Stationary rendered scene in desktop Chrome; not a physical phone or navigation benchmark.',
      })
      assert.deepEqual(errors, [])
      await context.close()
    }
  } finally {
    await browser.close()
  }
  await writeFile(
    resolve(values.output, 'production-audit.json'),
    JSON.stringify({ baseUrl: values.url, checkedAt: new Date().toISOString(), assets, reports }, null, 2),
  )
  console.log(JSON.stringify({ assets: assets.length, reports }, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
