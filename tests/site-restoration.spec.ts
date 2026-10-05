import { expect, test } from '@playwright/test'

const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5173'

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`direct floor switching at ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(appUrl)
    await page.getByRole('button', { name: /Zielonki house study/ }).click()
    await expect(page.locator('canvas')).toBeVisible()
    await page.getByRole('button', { name: 'House interior', exact: true }).click()
    const floors = page.getByRole('navigation', { name: 'House levels' })
    const buttons = floors.getByRole('button')
    await expect(buttons).toHaveCount(2)
    await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'true')
    for (const mode of ['2D Plan', '3D Interior', 'Perspective room view']) {
      await page.getByRole('button', { name: mode, exact: true }).click()
      await buttons.nth(1).click()
      await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('.interior-title small')).toHaveText(await buttons.nth(1).innerText())
      await buttons.nth(0).click()
      await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'true')
    }
    const bounds = await floors.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width)
    await page.getByRole('button', { name: '3D Interior', exact: true }).click()
    await buttons.nth(1).click()
    await page.screenshot({ path: testInfo.outputPath('upper-floor.png') })
    expect(errors).toEqual([])
  })
}

test('hardware Automatic uses detailed assets and explicit quality persists on reload', async ({ page }) => {
  await page.goto(appUrl)
  await page.getByRole('button', { name: /Zielonki house study/ }).click()
  await expect.poll(() => page.evaluate(async () => {
    const { useRenderingPreferences } = await import('/src/scene/renderingPreferences.ts')
    return useRenderingPreferences.getState().software
  })).not.toBeNull()
  // Deterministically exercise the hardware branch even on software-only test machines.
  await page.evaluate(async () => {
    const { useRenderingPreferences } = await import('/src/scene/renderingPreferences.ts')
    useRenderingPreferences.getState().setSoftware(false)
  })
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.includes('conifer-realistic.glb')))).toBe(true)
  await page.getByLabel('View quality', { exact: true }).selectOption('fast')
  await page.reload()
  await page.getByRole('button', { name: /Zielonki house study/ }).click()
  await expect(page.getByLabel('View quality', { exact: true })).toHaveValue('fast')
})
