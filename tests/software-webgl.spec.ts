import { expect, test } from '@playwright/test'

const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5173'

// Explicitly opt in only inside this isolated, trusted local QA browser.
test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } })
test('automatic quality uses the fast path and tools remain responsive', async ({ page }) => {
  test.setTimeout(120_000)
  const assets: string[] = []
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' || (message.type() === 'warning' && /WebGL|texture unit|GPU stall/i.test(message.text()))) errors.push(message.text())
  })
  page.on('request', request => { if (/\/(models|textures)\//.test(request.url())) assets.push(request.url()) })
  await page.goto(appUrl)
  await page.getByRole('button', { name: /Zielonki house study/ }).click()
  await expect(page.locator('canvas')).toBeVisible()
  const renderer = await page.evaluate(() => {
    const gl = document.querySelector('canvas')!.getContext('webgl2')!
    const extension = gl.getExtension('WEBGL_debug_renderer_info')!
    return gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
  })
  expect(renderer).toMatch(/swiftshader/i)
  await page.getByRole('button', { name: 'MCP Tools', exact: true }).click({ timeout: 5000 })
  await expect(page.getByRole('region', { name: 'WebMCP tool catalog' })).toBeVisible()
  expect(assets).toEqual([])
  await page.getByRole('button', { name: 'Close MCP tools', exact: true }).click()
  await page.getByRole('button', { name: 'Length', exact: true }).click({ timeout: 5000 })
  await page.getByRole('button', { name: 'Enter two points', exact: true }).click()
  await expect(page.getByLabel('Exact distance result')).toContainText('1.000 m')
  await page.getByRole('button', { name: 'Clear points', exact: true }).click()
  await page.getByRole('button', { name: 'Area', exact: true }).click({ timeout: 5000 })
  await page.getByRole('button', { name: 'Sun controls', exact: true }).click({ timeout: 5000 })
  await page.getByRole('button', { name: 'Play day', exact: true }).click()
  await page.getByRole('button', { name: 'Play day', exact: true }).click()
  await page.getByRole('button', { name: 'Architectural set', exact: true }).click({ timeout: 5000 })
  await expect(page.getByRole('region', { name: 'Architectural structure report' })).toBeVisible({ timeout: 30_000 })
  // The shared outbuilding contributes its own floor plan.
  await expect.poll(() => page.locator('.report-panel .thumbs img').evaluateAll(images => images.length === 11 && images.every(image => (image as HTMLImageElement).naturalWidth === 960))).toBe(true)
  expect(errors).toEqual([])
})
