import { expect, test, type Page } from '@playwright/test'

const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5173'
const drawCalls = (page: Page) => page.evaluate(() => (window as any).__renderPerf.draws as number)

async function expectIdle(page: Page) {
  await expect.poll(async () => {
    const before = await drawCalls(page)
    await page.waitForTimeout(700)
    return (await drawCalls(page)) - before
  }, { timeout: 45_000, intervals: [500] }).toBe(0)
}

test('editors load on demand, stop drawing when idle, and wake for navigation', async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const sceneRequests: string[] = []
  page.on('request', request => {
    if (/\/(textures|models)\//.test(request.url())) sceneRequests.push(request.url())
  })
  await page.addInitScript(() => {
    const metrics = { draws: 0, firstDrawMs: 0, longTaskMs: 0 }
    ;(window as any).__renderPerf = metrics
    for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const prototype = WebGL2RenderingContext.prototype as any
      const original = prototype[method]
      prototype[method] = function (...args: unknown[]) {
        metrics.draws++
        if (!metrics.firstDrawMs) metrics.firstDrawMs = performance.now()
        return original.apply(this, args)
      }
    }
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) metrics.longTaskMs += entry.duration
    }).observe({ type: 'longtask', buffered: true })
  })
  const started = Date.now()
  await page.goto(appUrl)
  const launcher = page.getByRole('dialog', { name: 'Where do you want to plan today?' })
  await expect(launcher).toBeVisible()
  const launcherMs = Date.now() - started
  await expect(launcher.getByRole('button', { name: /Zielonki house study/ })).toBeEnabled()
  expect(sceneRequests).toEqual([])
  await expect(page.locator('canvas')).toHaveCount(0)
  const opened = Date.now()
  await launcher.getByRole('button', { name: /Zielonki house study/ }).click()
  await expect(page.locator('canvas')).toHaveCount(1)
  await expect.poll(() => drawCalls(page), { timeout: 45_000 }).toBeGreaterThan(0)
  const firstSceneMs = Date.now() - opened
  await expectIdle(page)
  const before = await drawCalls(page)
  await page.waitForTimeout(2000)
  const idleDrawCallsPerSecond = ((await drawCalls(page)) - before) / 2
  expect(idleDrawCallsPerSecond).toBe(0)
  const metrics = await page.evaluate(() => ({
    ...(window as any).__renderPerf,
    paint: performance.getEntriesByType('paint').map(e => ({ name: e.name, ms: e.startTime })),
    resources: performance.getEntriesByType('resource').reduce((result, entry) => {
      result.bytes += (entry as PerformanceResourceTiming).transferSize
      result.requests++
      return result
    }, { bytes: 0, requests: 0 }),
  }))
  await testInfo.attach('startup-metrics', { body: JSON.stringify({ launcherMs, firstSceneMs, idleDrawCallsPerSecond, ...metrics }, null, 2), contentType: 'application/json' })
  console.log(JSON.stringify({ launcherMs, firstSceneMs, idleDrawCallsPerSecond, ...metrics }))
  await page.screenshot({ path: testInfo.outputPath('plot.png') })

  const canvas = page.locator('canvas')
  await canvas.hover({ position: { x: 600, y: 400 } })
  await page.mouse.wheel(0, -220)
  await expect.poll(() => drawCalls(page)).toBeGreaterThan(before)
  await expectIdle(page)
  const afterZoom = await drawCalls(page)
  await page.getByRole('button', { name: 'Refocus on Main house', exact: true }).click()
  await expect.poll(() => drawCalls(page)).toBeGreaterThan(afterZoom)
  await expectIdle(page)

  await page.getByRole('button', { name: 'Sun controls', exact: true }).click()
  const beforeSun = await drawCalls(page)
  await page.getByRole('button', { name: 'Play day', exact: true }).click()
  await expect.poll(() => drawCalls(page)).toBeGreaterThan(beforeSun)
  await page.getByRole('button', { name: 'Play day', exact: true }).click()
  await expectIdle(page)

  await page.getByRole('button', { name: 'Length', exact: true }).click()
  await page.getByRole('button', { name: 'Enter two points', exact: true }).click()
  await expect(page.getByLabel('Exact distance result')).toContainText('1.000 m')
  await expect(page.locator('.spatial-measurement-label.length')).toBeVisible()
  await page.getByRole('button', { name: 'Clear points', exact: true }).click()
  await expect(page.locator('.spatial-measurement-label.length')).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expectIdle(page)

  await page.getByRole('button', { name: 'House interior', exact: true }).click()
  await expect(page.getByRole('main', { name: 'House interior editor' })).toBeVisible()
  await expectIdle(page)
  const beforePlan = await drawCalls(page)
  await page.getByRole('button', { name: '2D Plan', exact: true }).click()
  await expect.poll(() => drawCalls(page)).toBeGreaterThan(beforePlan)
  await expectIdle(page)
  await page.screenshot({ path: testInfo.outputPath('interior.png') })
  await page.getByRole('button', { name: 'Back to plot', exact: true }).click()
  await expect(canvas).toHaveAttribute('aria-label', 'Interactive ProjectV2 spatial editor')
  await expectIdle(page)
  expect(errors).toEqual([])
})

test('a newly applied scan loads before architectural capture', async ({ page }) => {
  test.setTimeout(90_000)
  page.setDefaultTimeout(15_000)
  await page.goto(appUrl)
  await page.getByRole('button', { name: /Zielonki house study/ }).click()
  await expect(page.locator('canvas')).toBeVisible()
  // Keep the new scan in flight after the initial project's textures have loaded.
  await page.waitForTimeout(6000)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let requested = false
  await page.route('**/textures/medieval_red_brick/**', async route => {
    requested = true
    await gate
    await route.continue()
  })
  try {
    await page.locator('.wall-tree').first().getByRole('button').first().click()
    await page.getByText('Façade layout presets', { exact: true }).click()
    await page.getByRole('group', { name: 'Wall material', exact: true }).getByRole('button', { name: /^Brick/ }).click()
    await page.getByRole('button', { name: 'Apply to this wall', exact: true }).click()
    await expect.poll(() => requested).toBe(true)
    await page.getByRole('button', { name: 'Architectural set', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Rendering…', exact: true })).toBeDisabled()
    await expect(page.getByRole('region', { name: 'Architectural structure report' })).toHaveCount(0)
  } finally {
    release()
  }
  await expect(page.getByRole('region', { name: 'Architectural structure report' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.report-panel .drawing img')).toBeVisible()
})
