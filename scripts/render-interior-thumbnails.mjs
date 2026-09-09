/**
 * Brief: Render original GLB furniture into reproducible catalogue thumbnails.
 * Inputs: --url local Vite origin (default http://127.0.0.1:5187); --output directory
 * (default public/models/interior); catalogue JSON and GLBs built by build-interior-assets.mjs.
 * Outputs: One PNG thumbnail per catalogue configuration, rendering metrics JSON and CLI progress. No environment variables.
 * Usage: node scripts/render-interior-thumbnails.mjs --url http://127.0.0.1:5187
 */
import { chromium } from '@playwright/test'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

async function main() {
  const { values } = parseArgs({
    options: {
      url: { type: 'string', default: 'http://127.0.0.1:5187' },
      output: { type: 'string', default: 'public/models/interior' },
      help: { type: 'boolean' },
    },
  })
  if (values.help) {
    console.log(
      'Usage: node scripts/render-interior-thumbnails.mjs [--url http://127.0.0.1:5187] [--output public/models/interior]',
    )
    return
  }
  const output = resolve(values.output)
  await mkdir(output, { recursive: true })
  const products = JSON.parse(await readFile('src/domain/ikea-products.json', 'utf8'))
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const results = []
  try {
    const page = await browser.newPage({ viewport: { width: 512, height: 448 } })
    await page.goto(`${values.url}/scripts/interior-asset-preview.html`)
    await page.waitForFunction(() => window.studioReady)
    for (const product of products) {
      const stats = await page.evaluate((id) => window.renderProduct(id), product.id)
      await page.locator('canvas').screenshot({ path: resolve(output, `${product.id}.png`) })
      results.push({ id: product.id, ...stats })
      console.log(`Rendered ${product.id}`)
    }
    await writeFile(resolve(output, 'render-metrics.json'), JSON.stringify(results, null, 2) + '\n')
  } finally {
    await browser.close()
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
