import { expect, test, type Page } from '@playwright/test'
import { saveLegacyZielonki } from './helpers/legacy-zielonki'

const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5173'

async function sceneState(page: Page, world?: [number, number, number]) {
  return page.evaluate(async (world) => {
    const modulePath = '/node_modules/.vite/deps/@react-three_fiber.js'
    const { _roots } = await import(modulePath)
    const canvas = document.querySelector('canvas')!
    const { camera, scene, controls } = _roots.get(canvas).store.getState()
    const bounds = canvas.getBoundingClientRect()
    const points: number[][] = []
    scene.traverse((object: any) => { if (object.userData.measurementPoint) points.push(object.getWorldPosition(camera.position.clone()).toArray()) })
    const position = world ? camera.position.clone().set(...world).project(camera) : null
    return {
      camera: [...camera.position.toArray(), ...camera.quaternion.toArray(), camera.zoom], enabled: controls?.enabled ?? null, points,
      screen: position ? { x: bounds.left + (position.x + 1) * bounds.width / 2, y: bounds.top + (1 - position.y) * bounds.height / 2 } : null,
    }
  }, world)
}

async function clickWorld(page: Page, world: [number, number, number], offset = 0) {
  const point = (await sceneState(page, world)).screen!
  await page.mouse.click(point.x + offset, point.y)
}

test.beforeEach(async ({ page }) => {
  await page.goto(appUrl)
  await saveLegacyZielonki(page)
  await page.getByRole('button', { name: /Zielonki house study/ }).click()
  await expect.poll(async () => (await sceneState(page)).enabled, { timeout: 30000 }).toBe(true)
})

test('interior snaps to furniture, drags either endpoint, cancels a drag and keeps the camera fixed while moving furniture', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message))
  await page.getByRole('button', { name: 'House interior', exact: true }).click()
  await page.getByRole('button', { name: '2D Plan', exact: true }).click()
  await page.getByRole('button', { name: 'Aa Labels' }).click()
  for (const x of [-4, 1]) {
    await page.getByRole('button', { name: 'Place Linen sofa', exact: true }).click()
    await clickWorld(page, [x, 0, -2])
    await expect(page.getByRole('heading', { name: 'Linen sofa', exact: true })).toBeVisible()
  }
  await page.getByRole('button', { name: '↔ Measure', exact: true }).click()
  await clickWorld(page, [-2.8, 0.09, -2], 5)
  await clickWorld(page, [-0.2, 0.09, -2], -5)
  await expect(page.locator('.interior-tool-prompt')).toContainText('2.60 m')
  expect((await sceneState(page)).points[0][0]).toBeCloseTo(-2.8, 5)
  const before = await sceneState(page)
  const first = (await sceneState(page, before.points[0] as [number, number, number])).screen!
  const target = (await sceneState(page, [-1.037, 0.09, 1.023])).screen!
  await page.keyboard.down('Alt')
  await page.mouse.move(first.x, first.y); await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 10 }); await page.mouse.up()
  await page.keyboard.up('Alt')
  const after = await sceneState(page)
  expect(after.points).toHaveLength(2)
  expect(after.points[0][0]).toBeCloseTo(-1.037, 3)
  expect(after.points[1]).toEqual(before.points[1])
  expect(after.camera).toEqual(before.camera)
  // Cancelling a captured endpoint drag restores the previous measurement.
  await page.evaluate(() => document.addEventListener('pointerdown', (event) => { document.querySelector('canvas')!.dataset.testPointerId = String(event.pointerId) }, { capture: true, once: true }))
  await page.mouse.move(target.x, target.y); await page.mouse.down(); await page.mouse.move(target.x + 40, target.y + 30)
  await page.evaluate(() => { const canvas = document.querySelector('canvas')!; canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: Number(canvas.dataset.testPointerId), bubbles: true })) })
  await page.mouse.up()
  await expect.poll(async () => (await sceneState(page)).points).toEqual(after.points)
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: '3D Interior', exact: true }).click()
  const sofa = (await sceneState(page, [-4, 0.65, -2])).screen!
  const furnitureCamera = (await sceneState(page)).camera
  await page.mouse.move(sofa.x, sofa.y); await page.mouse.down()
  await page.mouse.move(sofa.x + 35, sofa.y, { steps: 12 })
  expect((await sceneState(page)).enabled).toBe(false)
  expect((await sceneState(page)).camera).toEqual(furnitureCamera)
  await page.mouse.up()
  expect((await sceneState(page)).camera).toEqual(furnitureCamera)
  expect((await sceneState(page)).enabled).toBe(true)
  await expect(page.getByRole('heading', { name: 'Linen sofa', exact: true })).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: 'Position X (m)' })).not.toHaveValue('-4')
  await page.screenshot({ path: 'test-results/measurement-interior.png' })
  expect(errors).toEqual([])
})

test('plot measurement endpoints can be adjusted and repositioning locks the camera', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message))
  await page.getByRole('button', { name: 'Length', exact: true }).click()
  await clickWorld(page, [10, 0.14, 9])
  await clickWorld(page, [14, 0.14, 9])
  await expect(page.locator('.spatial-measurement-label.length')).toBeVisible()
  const before = await sceneState(page)
  const second = (await sceneState(page, before.points[1] as [number, number, number])).screen!
  await page.mouse.move(second.x, second.y); await page.mouse.down()
  await page.mouse.move(second.x + 45, second.y + 30, { steps: 10 }); await page.mouse.up()
  const after = await sceneState(page)
  expect(after.points).toHaveLength(2)
  expect(after.points[0]).toEqual(before.points[0])
  expect(after.points[1]).not.toEqual(before.points[1])
  expect(after.camera).toEqual(before.camera)
  await page.getByRole('button', { name: 'Area', exact: true }).click()
  const a = (await sceneState(page, [10, 0.14, 9])).screen!
  const b = (await sceneState(page, [14, 0.14, 12])).screen!
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up()
  await expect(page.locator('.spatial-measurement-label.area')).toBeVisible()
  const area = await sceneState(page)
  const corner = (await sceneState(page, area.points[0] as [number, number, number])).screen!
  await page.mouse.move(corner.x, corner.y); await page.mouse.down(); await page.mouse.move(corner.x - 30, corner.y, { steps: 8 }); await page.mouse.up()
  expect((await sceneState(page)).points[0]).not.toEqual(area.points[0])
  expect((await sceneState(page)).points[1]).toEqual(area.points[1])
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('.model-tree').first().getByRole('button').first().click()
  await page.getByRole('button', { name: 'Move', exact: true }).click()
  await expect.poll(async () => (await sceneState(page)).enabled).toBe(false)
  const locked = await sceneState(page)
  const canvas = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(canvas.x + 50, canvas.y + 100); await page.mouse.down()
  await page.mouse.move(canvas.x + 120, canvas.y + 160, { steps: 10 }); await page.mouse.up()
  expect((await sceneState(page)).camera).toEqual(locked.camera)
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await sceneState(page)).enabled).toBe(true)
  expect(errors).toEqual([])
})
