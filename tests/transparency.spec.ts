import { expect, test } from '@playwright/test'

const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5173'

test('fade roofs and walls, orbit, finish and reset without editing project data', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(appUrl)
  await page.getByRole('button', { name: /Zielonki house study/ }).click()
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const storeUrl = performance.getEntriesByType('resource').map(entry => entry.name).find(url => new URL(url).pathname === '/src/state/store.ts')!
    const { useStudioStore } = await load(storeUrl)
    const { _roots } = await load('/node_modules/.vite/deps/@react-three_fiber.js')
    const { Raycaster, Vector2 } = await load('/node_modules/.vite/deps/three.js')
    const { transparencyRef } = await load('/src/scene/transparencyMaterials.ts')
    const canvas = document.querySelector('canvas')!
    const sceneState = () => _roots.get(canvas).store.getState()
    ;(window as any).transparencyTest = {
      store: useStudioStore,
      original: JSON.stringify(useStudioStore.getState().project),
      point(kind: string) {
        const { scene, camera } = sceneState()
        const rect = canvas.getBoundingClientRect()
        const faded = useStudioStore.getState().transparentRefs
        const ray = new Raycaster()
        scene.updateMatrixWorld(true)
        for (let y = 0.15; y < 0.85; y += 0.025) for (let x = 0.15; x < 0.85; x += 0.025) {
          ray.setFromCamera(new Vector2(x * 2 - 1, 1 - y * 2), camera)
          const hits = ray.intersectObjects(scene.children, true).filter((hit: any) => hit.object.isMesh && transparencyRef(hit.object) && !faded.includes(transparencyRef(hit.object)))
          const ref = hits[0] && transparencyRef(hits[0].object)
          if (kind === 'roof' && !hits.some((hit: any) => transparencyRef(hit.object) !== ref)) continue
          const screenX = rect.left + rect.width * x; const screenY = rect.top + rect.height * y
          if (ref?.includes(kind) && document.elementFromPoint(screenX, screenY) === canvas) return { x: screenX, y: screenY, ref }
        }
        return null
      },
      materials(ref: string) {
        const result: number[] = []
        sceneState().scene.traverse((object: any) => {
          if (object.isMesh && transparencyRef(object) === ref) {
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) result.push(material.opacity)
          }
        })
        return result
      },
    }
  })
  const mode = page.getByRole('button', { name: 'Make objects transparent', exact: true })
  const reset = page.getByRole('button', { name: 'Reset object transparency', exact: true })
  await expect(reset).toBeDisabled()
  await mode.click()
  await expect(mode).toHaveAttribute('aria-pressed', 'true')
  for (const kind of ['roof', 'wall']) {
    await expect.poll(() => page.evaluate(kind => (window as any).transparencyTest.point(kind), kind), { timeout: 45_000 }).not.toBeNull()
    const point = await page.evaluate(kind => (window as any).transparencyTest.point(kind), kind)
    await page.mouse.click(point.x, point.y)
    await expect.poll(() => page.evaluate(ref => (window as any).transparencyTest.store.getState().transparentRefs.includes(ref), point.ref)).toBe(true)
    await expect.poll(() => page.evaluate(ref => (window as any).transparencyTest.materials(ref).every((opacity: number) => opacity <= 0.12), point.ref)).toBe(true)
    if (kind === 'roof') {
      // The same pixel must now reach a different object behind the faded roof.
      await page.mouse.click(point.x, point.y)
      await expect.poll(() => page.evaluate(() => (window as any).transparencyTest.store.getState().transparentRefs.length)).toBe(2)
    }
  }
  const before = await page.evaluate(() => (window as any).transparencyTest.store.getState().transparentRefs)
  const canvas = await page.locator('canvas').boundingBox()
  await page.mouse.move(canvas!.x + canvas!.width / 2, canvas!.y + canvas!.height / 2)
  await page.mouse.down()
  await page.mouse.move(canvas!.x + canvas!.width / 2 + 80, canvas!.y + canvas!.height / 2 + 30, { steps: 8 })
  await page.mouse.up()
  expect(await page.evaluate(() => (window as any).transparencyTest.store.getState().transparentRefs)).toEqual(before)
  await page.keyboard.press('Escape')
  await expect(mode).toHaveAttribute('aria-pressed', 'false')
  await page.screenshot({ path: testInfo.outputPath('transparent-desktop.png') })
  await reset.click()
  await expect(reset).toBeDisabled()
  expect(await page.evaluate(() => JSON.stringify((window as any).transparencyTest.store.getState().project) === (window as any).transparencyTest.original)).toBe(true)
  for (const ref of before) {
    await expect.poll(() => page.evaluate(ref => (window as any).transparencyTest.materials(ref).some((opacity: number) => opacity > 0.12), ref)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(mode).toBeVisible()
  await expect(reset).toBeVisible()
  await mode.click()
  await expect(mode).toHaveAttribute('aria-pressed', 'true')
  const mobileBounds = await mode.boundingBox()
  expect(mobileBounds!.x + mobileBounds!.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('transparent-mobile.png') })
  await page.reload()
  await page.getByRole('button', { name: /Zielonki house study/ }).click()
  await expect(mode).toHaveAttribute('aria-pressed', 'false')
  await expect(reset).toBeDisabled()
  expect(errors).toEqual([])
})
