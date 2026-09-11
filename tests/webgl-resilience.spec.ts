import { expect, test, type Page } from '@playwright/test'

const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5173'

async function openStudy(page: Page) {
  await page.goto(appUrl)
  await page.getByRole('button', { name: /Zielonki house study/ }).click()
  await expect(page.locator('canvas')).toBeVisible()
}

test('tools remain usable while loading and reports use asynchronous readback', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' || (message.type() === 'warning' && /WebGL|texture unit|GPU stall/i.test(message.text()))) errors.push(message.text())
  })
  await page.addInitScript(() => {
    const metrics = { syncReads: 0, asyncReads: 0, invalidTextures: 0, longTasks: [] as number[] }
    ;(window as any).__webglQa = metrics
    const prototype = WebGL2RenderingContext.prototype as any
    const read = prototype.readPixels
    prototype.readPixels = function (...args: any[]) {
      if (typeof args[6] === 'number') metrics.asyncReads++
      else metrics.syncReads++
      return read.apply(this, args)
    }
    const active = prototype.activeTexture
    const limits = new WeakMap<WebGL2RenderingContext, number>()
    prototype.activeTexture = function (unit: number) {
      if (!limits.has(this)) limits.set(this, this.getParameter(this.MAX_COMBINED_TEXTURE_IMAGE_UNITS))
      if (unit < this.TEXTURE0 || unit >= this.TEXTURE0 + limits.get(this)!) metrics.invalidTextures++
      return active.call(this, unit)
    }
    new PerformanceObserver(list => metrics.longTasks.push(...list.getEntries().map(entry => entry.duration))).observe({ type: 'longtask', buffered: true })
  })
  await openStudy(page)
  const started = Date.now()
  await page.getByRole('button', { name: 'MCP Tools', exact: true }).click({ timeout: 5000 })
  await expect(page.getByRole('region', { name: 'WebMCP tool catalog' })).toBeVisible({ timeout: 5000 })
  const startupClickMs = Date.now() - started
  await page.getByLabel('Search tools', { exact: true }).fill('structure')
  await expect(page.getByRole('navigation', { name: 'WebMCP tools' })).toContainText('show_structure_views')
  await page.getByRole('button', { name: 'Close MCP tools', exact: true }).click()
  for (const name of ['Length', 'Area', 'Sun controls', 'Edit']) await page.getByRole('button', { name, exact: true }).click({ timeout: 5000 })
  const reportStarted = Date.now()
  await page.getByRole('button', { name: 'Architectural set', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Architectural structure report' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.report-panel .thumbs img')).toHaveCount(10)
  await expect.poll(() => page.locator('.report-panel .thumbs img').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth === 960))).toBe(true)
  const metrics = await page.evaluate(() => (window as any).__webglQa)
  expect(metrics.syncReads).toBe(0)
  expect(metrics.asyncReads).toBe(10)
  expect(metrics.invalidTextures).toBe(0)
  await testInfo.attach('webgl-metrics', { body: JSON.stringify({ startupClickMs, reportMs: Date.now() - reportStarted, ...metrics }, null, 2), contentType: 'application/json' })
  await page.getByRole('button', { name: 'Close report', exact: true }).click()
  await page.getByLabel('View quality', { exact: true }).selectOption('detailed')
  await page.getByRole('button', { name: 'Architectural set', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel report', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Architectural set', exact: true })).toBeEnabled({ timeout: 15_000 })
  await expect(page.getByRole('region', { name: 'Architectural structure report' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Architectural set', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Architectural structure report' })).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => page.locator('.report-panel .thumbs img').evaluateAll(images => images.length === 10 && images.every(image => (image as HTMLImageElement).naturalWidth === 960))).toBe(true)
  const drawingColors = await page.locator('.report-panel .thumbs img').evaluateAll(images => images.map(element => {
    const image = element as HTMLImageElement
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    // Exclude captions and scale labels: successfully decoded headers are not a drawing.
    context.drawImage(image, 0, 70, image.naturalWidth, image.naturalHeight - 120, 0, 0, 64, 64)
    return new Set(new Uint32Array(context.getImageData(0, 0, 64, 64).data.buffer)).size
  }))
  expect(drawingColors.every(colors => colors > 20)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('detailed-report.png') })
  expect(errors).toEqual([])
})

test('unavailable WebGL leaves the HTML tools accessible', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type: any, ...args: any[]) {
      if (/webgl/.test(type)) return null
      return (getContext as any).call(this, type, ...args)
    } as any
  })
  await page.goto(appUrl)
  await page.getByRole('button', { name: /Zielonki house study/ }).click()
  await expect(page.getByRole('button', { name: 'Retry 3D in fast mode' })).toBeVisible()
  await page.getByRole('button', { name: 'MCP Tools', exact: true }).click()
  await expect(page.getByRole('region', { name: 'WebMCP tool catalog' })).toBeVisible()
})

test('a lost graphics context can be retried without losing the project', async ({ page }) => {
  await openStudy(page)
  await expect.poll(() => page.evaluate(() => {
    const gl = document.querySelector('canvas')?.getContext('webgl2')
    return !!gl && !gl.isContextLost()
  })).toBe(true)
  await page.waitForTimeout(1000)
  await page.evaluate(() => document.querySelector('canvas')!.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext())
  await expect(page.getByRole('button', { name: 'Retry 3D in fast mode' })).toBeVisible()
  await page.getByRole('button', { name: 'Retry 3D in fast mode' }).click()
  await expect(page.locator('canvas')).toBeVisible()
  await page.getByRole('button', { name: 'MCP Tools', exact: true }).click()
  await expect(page.getByRole('region', { name: 'WebMCP tool catalog' })).toBeVisible()
})


test('interior PNG contains a rendered scene without a preserved drawing buffer', async ({ page }) => {
  await openStudy(page)
  await page.getByRole('button', { name: 'House interior', exact: true }).click()
  await expect(page.getByRole('application', { name: 'Interactive interior floor' })).toBeVisible()
  await page.getByRole('button', { name: 'More', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export scene PNG', exact: true }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('interior-scene.png')
  const stream = await file.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  const pixels = await page.evaluate(async data => {
    const image = new Image()
    image.src = 'data:image/png;base64,' + data
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    context.drawImage(image, 0, 0, 64, 64)
    const values = new Uint32Array(context.getImageData(0, 0, 64, 64).data.buffer)
    return { width: image.naturalWidth, colors: new Set(values).size }
  }, Buffer.concat(chunks).toString('base64'))
  expect(pixels.width).toBeGreaterThan(500)
  expect(pixels.colors).toBeGreaterThan(20)
})
