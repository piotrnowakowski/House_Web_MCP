import { writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

for (const mobile of [false, true]) test.describe(mobile ? 'mobile oak' : 'desktop oak', () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, hasTouch: mobile })
  test('shows the saved oak lining through exterior glazing and preserves it after restore', async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', route => route.fulfill({ status: 503, body: '{}' }))
    await page.addInitScript(() => localStorage.setItem('render-quality', 'fast'))
    await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5217')
    await page.getByRole('button', { name: 'Otwórz projekt: architekt 7.11', exact: true }).click()
    await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 })
    await page.evaluate(async () => {
      const load = (path: string) => import(/* @vite-ignore */ path)
      const { _roots } = await load('/node_modules/.vite/deps/@react-three_fiber.js')
      const { Vector3, Raycaster } = await load('/node_modules/.vite/deps/three.js')
      const { useStudioStore } = await load('/src/state/store.ts')
      const { transparencyRef } = await load('/src/scene/transparencyMaterials.ts')
      const state = () => _roots.get(document.querySelector('canvas')!)?.store.getState()
      ;(window as any).oakTest = {
        original: JSON.stringify(useStudioStore.getState().project),
        store: useStudioStore,
        surfaces() {
          const surfaces: any[] = []
          if (!state()) return surfaces
          state().scene.traverse((object: any) => {
            if (!object.isMesh) return
            let owner = object
            while (owner && !owner.userData.interiorFinish) owner = owner.parent
            if (owner?.userData.interiorFinish === 'natural-oak') surfaces.push({ ref: transparencyRef(object), mapped: !!object.material.map?.image, opacity: object.material.opacity, visible: object.material.visible })
          })
          return surfaces
        },
        ceilingVisibleFromBelow() {
          const { scene } = state(); scene.updateMatrixWorld(true)
          let house: any
          scene.traverse((object: any) => { if (object.userData.captureRoot && object.userData.semanticRef === 'house/main') house = object })
          if (!house) return false
          const ray = new Raycaster(new Vector3(2.6, 5, -2.8).applyMatrix4(house.matrixWorld), new Vector3(0, 1, 0))
          ray.camera = state().camera
          const hit = ray.intersectObjects(scene.children, true).find((hit: any) => hit.object.isMesh && transparencyRef(hit.object) && hit.object.material.visible && hit.object.material.opacity === 1)
          return hit?.object.userData.interiorFinish === 'natural-oak'
        },
        savedCamera() { const { camera, controls } = state(); return { controls: controls.toJSON(), view: camera.view } },
        look(from: number[]) {
          const { scene, camera, controls, invalidate } = state()
          let house: any
          scene.traverse((object: any) => { if (object.userData.captureRoot && object.userData.semanticRef === 'house/main') house = object })
          if (!house) return false
          scene.updateMatrixWorld(true)
          const eye = new Vector3(...from).applyMatrix4(house.matrixWorld)
          const target = new Vector3(2.8, 3.7, -2.8).applyMatrix4(house.matrixWorld)
          camera.clearViewOffset(); controls.setFocalOffset(0, 0, 0, false)
          controls.setLookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, false); controls.update(1); invalidate()
          return true
        },
      }
    })
    const expectedWalls = [
      'wall/architekt/ground/18', 'wall/architekt/ground/20', 'wall/architekt/upper/26',
      'wall/architekt/correction/1/child-two/3', 'wall/architekt/correction/1/living-void/1',
    ]
    await expect.poll(() => page.evaluate(() => (window as any).oakTest.surfaces().filter((s: any) => s.mapped).map((s: any) => s.ref)), { timeout: 30_000 }).toEqual(expect.arrayContaining([...expectedWalls, 'ceiling/slab/reference-upper/void/1']))
    await expect.poll(() => page.evaluate(() => (window as any).oakTest.ceilingVisibleFromBelow())).toBe(true)
    for (const [index, from] of (mobile ? [[18, 5, -7], [18, 5, 2]] : [[11, 4.8, -7], [11, 4.8, 2]]).entries()) {
      await expect.poll(() => page.evaluate(from => (window as any).oakTest.look(from), from)).toBe(true)
      await page.waitForTimeout(500)
      await page.screenshot({ path: testInfo.outputPath(`oak-through-glass-${index}.png`) })
      writeFileSync(testInfo.outputPath(`camera-${index}.json`), JSON.stringify(await page.evaluate(() => (window as any).oakTest.savedCamera())))
    }
    // The lining shares the wall identity, so hiding a wall must also remove its finish.
    await page.evaluate(ref => (window as any).oakTest.store.getState().makeTransparent(ref), expectedWalls[0])
    await expect.poll(() => page.evaluate(ref => (window as any).oakTest.surfaces().filter((s: any) => s.ref === ref).every((s: any) => s.opacity === 0 && !s.visible), expectedWalls[0])).toBe(true)
    await page.getByRole('button', { name: 'Przywróć widoczność', exact: true }).click()
    await expect.poll(() => page.evaluate(ref => (window as any).oakTest.surfaces().filter((s: any) => s.ref === ref).every((s: any) => s.opacity === 1 && s.visible && s.mapped), expectedWalls[0])).toBe(true)
    expect(await page.evaluate(() => JSON.stringify((window as any).oakTest.store.getState().project) === (window as any).oakTest.original)).toBe(true)
    expect(errors).toEqual([])
  })
})
