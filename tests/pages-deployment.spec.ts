import { expect, test } from '@playwright/test'

const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:4173/House_Web_MCP/'
const appBasePath = new URL(appUrl).pathname.replace(/\/$/, '')

const openZielonkiStudy = async (page: import('@playwright/test').Page) => {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
  const startScreen = page.getByRole('dialog', { name: 'Where do you want to plan today?' })
  await expect(startScreen).toBeVisible()
  await startScreen.getByRole('button', { name: /Zielonki house study/ }).click()
  await expect(startScreen).toBeHidden()
  await expect(page.locator('canvas')).toHaveCount(1)
  await expect(page.getByText('Spatial Editor', { exact: true })).toBeVisible()
}

test('GitHub Pages base path serves every requested garden model', async ({ page }) => {
  const modelResponses: Array<{ path: string; status: number }> = []
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname
    if (path.includes('/models/garden/')) modelResponses.push({ path, status: response.status() })
  })

  await openZielonkiStudy(page)

  await expect.poll(() => modelResponses.length, { timeout: 20_000 }).toBeGreaterThan(0)
  expect(modelResponses.every(({ path, status }) => path.startsWith(`${appBasePath}/models/garden/`) && status === 200)).toBe(true)
})

test('editor stays usable when optional garden models fail', async ({ page }) => {
  let blockedModelRequests = 0
  await page.route('**/models/garden/*.glb', (route) => {
    blockedModelRequests += 1
    return route.abort('failed')
  })

  await openZielonkiStudy(page)

  await expect.poll(() => blockedModelRequests, { timeout: 20_000 }).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Open garden fixtures' }).click()
  await expect(page.getByRole('region', { name: 'Garden fixture library' })).toBeVisible()
})
