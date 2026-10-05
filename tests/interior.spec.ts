import { expect, test, type Page } from '@playwright/test'
import { saveLegacyZielonki } from './helpers/legacy-zielonki'

const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5173'
async function state(page: Page) {
  return page.evaluate(async () => {
    const tools = (window as unknown as { __interiorTools: Record<string, { execute: (input: unknown) => Promise<{ content: { text: string }[] }> }> }).__interiorTools
    return JSON.parse((await tools.get_project_state.execute({ detail: 'structure' })).content[0].text).data
  })
}
async function point(page: Page, x: number, z: number) {
  const project = await state(page)
  const building = project.buildings[0]; const floor = building.storeys[0]
  const points = building.slabs.find((s: { ref: string }) => s.ref === floor.baseSlabRef).footprint
  const xs = points.map((p: { x: number }) => p.x); const zs = points.map((p: { z: number }) => p.z)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const box = (await page.locator('.interior-stage canvas').boundingBox())!
  const zoom = Math.min(box.width / ((maxX - minX + 5) * 1.15), box.height / (maxZ - minZ + 5))
  return { x: box.x + box.width / 2 + (x - (minX + maxX) / 2) * zoom, y: box.y + box.height / 2 + (z - (minZ + maxZ) / 2) * zoom }
}
test('interior editing persists furniture, names and dimensions; supports drag, floors, measurements and undo', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    const tools: Record<string, unknown> = {}
    Object.assign(window, { __interiorTools: tools })
    Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool: async (tool: { name: string }) => { tools[tool.name] = tool } } })
  })
  await page.goto(appUrl)
  await saveLegacyZielonki(page)
  await page.getByRole('button', { name: /Zielonki house study/ }).click()
  await page.getByRole('button', { name: 'House interior', exact: true }).click()
  await expect(page.getByRole('main', { name: 'House interior editor' })).toBeVisible()
  await page.getByRole('button', { name: '2D Plan', exact: true }).click()
  await page.getByRole('button', { name: 'Aa Labels' }).click()
  await page.getByRole('button', { name: 'Place Linen sofa' }).click()
  const start = await point(page, -4, -2); await page.mouse.click(start.x, start.y)
  await expect(page.getByRole('heading', { name: 'Linen sofa', exact: true })).toBeVisible()
  await page.getByRole('spinbutton', { name: 'Width (m)', exact: true }).fill('2.6')
  await page.getByRole('button', { name: 'Apply changes' }).click()
  await expect.poll(async () => (await state(page)).buildings[0].furniture[0].widthM).toBe(2.6)
  const end = await point(page, -3, -2)
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 12 }); await page.mouse.up()
  await expect.poll(async () => (await state(page)).buildings[0].furniture[0].position.x).toBeCloseTo(-3, 1)
  await page.getByRole('button', { name: 'Rotate 90°' }).click()
  await expect.poll(async () => (await state(page)).buildings[0].furniture[0].rotationDegrees).toBe(90)
  await page.getByRole('button', { name: /Upper storey/ }).click()
  await expect(page.getByRole('region', { name: 'Placed objects' })).toHaveCount(0)
  await page.getByRole('button', { name: /Ground storey/ }).click()
  await expect(page.getByRole('region', { name: 'Placed objects' })).toContainText('Linen sofa')
  await page.getByRole('region', { name: 'Rooms on this level' }).getByRole('button').first().click()
  await page.getByRole('textbox', { name: 'Room name', exact: true }).fill('Kitchen & breakfast')
  const width = page.getByRole('spinbutton', { name: 'Room width (m)' }); const originalWidth = Number(await width.inputValue())
  await width.fill(String(originalWidth - 0.4))
  await page.getByRole('button', { name: 'Save room' }).click()
  await expect(page.getByRole('heading', { name: 'Kitchen & breakfast' })).toBeVisible()
  await page.getByRole('button', { name: '↔ Measure', exact: true }).click()
  const a = await point(page, 2, -2), b = await point(page, 5, -2)
  await page.mouse.click(a.x, a.y); await page.mouse.click(b.x, b.y)
  await expect(page.locator('.interior-tool-prompt')).toContainText('3.00 m')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('region', { name: 'Placed objects' }).getByRole('button').first().click()
  await page.getByRole('button', { name: 'Delete object' }).click()
  await expect(page.getByRole('region', { name: 'Placed objects' })).toHaveCount(0)
  await page.getByRole('button', { name: '↶ Undo', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Placed objects' })).toContainText('Linen sofa')
  // Allow the real debounced IndexedDB autosave to finish, then open the saved workspace.
  await page.waitForTimeout(700)
  await page.reload()
  await page.getByRole('dialog').getByRole('button', { name: /Continue · Zielonki/ }).click()
  await page.getByRole('button', { name: 'House interior', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Placed objects' })).toContainText('Linen sofa')
  await expect(page.getByRole('region', { name: 'Rooms on this level' })).toContainText('Kitchen & breakfast')
  await expect(page.locator('.interior-room-label').first()).toBeVisible()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'test-results/interior-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: '3D Interior', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390)
  await page.screenshot({ path: 'test-results/interior-mobile.png' })
  expect(errors).toEqual([])
})

test('places bedroom, kitchen, bathroom and garage objects with realistic metre dimensions', async ({ page }) => {
  await page.addInitScript(() => {
    const tools: Record<string, unknown> = {}; Object.assign(window, { __interiorTools: tools })
    Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool: async (tool: { name: string }) => { tools[tool.name] = tool } } })
  })
  await page.goto(appUrl)
  await saveLegacyZielonki(page)
  await page.getByRole('button', { name: /Zielonki house study/ }).click()
  await page.getByRole('button', { name: 'House interior', exact: true }).click()
  await page.getByRole('button', { name: '2D Plan', exact: true }).click()
  await page.getByRole('button', { name: 'Aa Labels' }).click()
  for (const [name, x, z] of [
    ['Linen sofa', -5, 4], ['Coffee table', -5, 5.5], ['Lounge chair', -6.7, 5.5],
    ['Kitchen island', -4, -2], ['Kitchen cabinet', -6.5, -4.3], ['Refrigerator', -7.2, -2.8],
    ['Cooker & oven', -5.3, -4.3], ['Kitchen sink', -4.4, -4.3],
    ['Dining table & chairs', 2.2, -2], ['Family car', 6, -2],
    ['Freestanding bath', -7, 8], ['Bathroom vanity', -6, 9.1], ['Toilet', -3, 9], ['Walk-in shower', -3, 7.3],
  ] as [string, number, number][]) {
    await page.getByRole('button', { name: `Place ${name}`, exact: true }).click()
    const target = await point(page, x, z); await page.mouse.click(target.x, target.y)
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  }
  await expect(page.getByRole('region', { name: 'Placed objects' }).getByRole('button')).toHaveCount(14)
  await page.getByRole('button', { name: /Browse furniture & rooms/ }).click()
  await page.getByRole('button', { name: '3D Interior', exact: true }).click()
  await page.getByRole('button', { name: 'Aa Labels' }).click()
  await expect(page.locator('.interior-room-label').first()).toBeVisible()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'test-results/interior-furnished.png' })
  await page.getByRole('button', { name: /Upper storey/ }).click()
  await page.getByRole('button', { name: 'Place Double bed', exact: true }).click()
  // The upper-floor room label is centred on the slab; its position gives an unambiguous placement point.
  const label = (await page.locator('.interior-room-label').first().boundingBox())!
  await page.mouse.click(label.x + label.width / 2, label.y + label.height / 2)
  await expect(page.getByRole('heading', { name: 'Double bed', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Placed objects' }).getByRole('button')).toHaveCount(1)
})
