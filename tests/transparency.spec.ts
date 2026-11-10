import { expect, test, type Page } from '@playwright/test'

const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5173'

async function open(page: Page) {
  await page.route('**/api/**', route => route.fulfill({ status: 503, body: 'Isolated browser test' }))
  await page.goto(appUrl)
  await page.getByRole('dialog', { name: 'Który projekt chcesz otworzyć?' }).waitFor()
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { useStudioStore } = await load('/src/state/store.ts')
    const { default: canonical } = await load('/project-data/architekt-7-11/project.json')
    const project = structuredClone(canonical)
    project.ref = 'project/transparency-browser-test'
    useStudioStore.getState().replaceProject(project)
    useStudioStore.setState({ hydrated: true, launcherOpen: false, selectedRef: null })
  })
  await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 })
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const storeUrl = performance.getEntriesByType('resource').map(entry => entry.name).find(url => new URL(url).pathname === '/src/state/store.ts')!
    const { useStudioStore } = await load(storeUrl)
    const { _roots } = await load('/node_modules/.vite/deps/@react-three_fiber.js')
    const { Raycaster, Vector2, Box3, Vector3 } = await load('/node_modules/.vite/deps/three.js')
    const { transparencyRef } = await load('/src/scene/transparencyMaterials.ts')
    const sceneState = () => _roots.get(document.querySelector('canvas')!).store.getState()
    ;(window as any).transparencyTest = {
      store: useStudioStore,
      original: JSON.stringify(useStudioStore.getState().project),
      point(kind: string) {
        const { scene, camera } = sceneState()
        const canvas = document.querySelector('canvas')!
        const rect = canvas.getBoundingClientRect()
        const faded = useStudioStore.getState().transparentRefs
        const ray = new Raycaster()
        scene.updateMatrixWorld(true)
        const windows = new Set(useStudioStore.getState().project.buildings.flatMap((building: any) => building.walls.flatMap((wall: any) => wall.openings.filter((o: any) => o.kind === 'window').map((o: any) => o.ref))))
        const matches = (ref: string | null) => !!ref && (kind === 'furniture' ? ref.startsWith('interior/') : kind === 'window' ? windows.has(ref) : ref.includes(kind))
        const meshes: any[] = []
        scene.traverseVisible((object: any) => { if (object.isMesh && matches(transparencyRef(object)) && !faded.includes(transparencyRef(object))) meshes.push(object) })
        for (const mesh of meshes) {
          const projected = new Box3().setFromObject(mesh).getCenter(new Vector3()).project(camera)
          if (Math.abs(projected.x) > .95 || Math.abs(projected.y) > .95 || Math.abs(projected.z) > 1) continue
          const screenX = rect.left + rect.width * (projected.x + 1) / 2, screenY = rect.top + rect.height * (1 - projected.y) / 2
          if (document.elementFromPoint(screenX, screenY) !== canvas) continue
          ray.setFromCamera(new Vector2(projected.x, projected.y), camera)
          const hits = ray.intersectObjects(scene.children, true).filter((hit: any) => hit.object.isMesh && transparencyRef(hit.object) && !faded.includes(transparencyRef(hit.object)))
          const ref = hits[0] && transparencyRef(hits[0].object)
          if (kind === 'roof' && !hits.some((hit: any) => transparencyRef(hit.object) !== ref)) continue
          if (matches(ref)) return { x: screenX, y: screenY, ref }
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
}

async function unobscuredControls(page: Page) {
  for (const name of ['Przezroczystość', 'Przywróć widoczność']) {
    const button = page.getByRole('button', { name, exact: true })
    await expect(button).toBeVisible()
    expect(await button.evaluate(element => {
      const rect = element.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      const sync = document.querySelector('.workspace-save-bar')?.getBoundingClientRect()
      return element.contains(hit) && (!sync || rect.right <= sync.left || rect.left >= sync.right || rect.bottom <= sync.top || rect.top >= sync.bottom)
    })).toBe(true)
  }
}

test('fade roofs and walls, orbit, finish and reset without editing project data', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await open(page)
  const mode = page.getByRole('button', { name: 'Przezroczystość', exact: true })
  const reset = page.getByRole('button', { name: 'Przywróć widoczność', exact: true })
  await expect(reset).toBeDisabled()
  await mode.click()
  await expect(mode).toHaveAttribute('aria-pressed', 'true')
  for (const kind of ['roof', 'wall']) {
    await expect.poll(() => page.evaluate(kind => (window as any).transparencyTest.point(kind), kind), { timeout: 45_000 }).not.toBeNull()
    const point = await page.evaluate(kind => (window as any).transparencyTest.point(kind), kind)
    await page.mouse.click(point.x, point.y)
    await expect.poll(() => page.evaluate(ref => (window as any).transparencyTest.store.getState().transparentRefs.includes(ref), point.ref)).toBe(true)
    await expect.poll(() => page.evaluate(ref => (window as any).transparencyTest.materials(ref).every((opacity: number) => opacity === 0), point.ref)).toBe(true)
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
    await expect.poll(() => page.evaluate(ref => (window as any).transparencyTest.materials(ref).some((opacity: number) => opacity > 0), ref)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(mode).toBeVisible()
  await expect(reset).toBeVisible()
  await unobscuredControls(page)
  await mode.click()
  await expect(mode).toHaveAttribute('aria-pressed', 'true')
  const mobileBounds = await mode.boundingBox()
  expect(mobileBounds!.x + mobileBounds!.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('transparent-mobile.png') })
  await page.reload()
  await open(page)
  await expect(mode).toHaveAttribute('aria-pressed', 'false')
  await expect(reset).toBeDisabled()
  expect(errors).toEqual([])
})

for (const mobile of [false, true]) test.describe(mobile ? 'touch' : 'desktop', () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, hasTouch: mobile })
  test('interior transparency fades individual objects, restores and never moves them', async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await open(page)
    await page.getByRole('button', { name: 'Wnętrze domu', exact: true }).click()
    const mode = page.getByRole('button', { name: 'Przezroczystość', exact: true })
    const reset = page.getByRole('button', { name: 'Przywróć widoczność', exact: true })
    await expect(mode).toBeVisible()
    await unobscuredControls(page)
    const bounds = await reset.boundingBox()
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(mobile ? 390 : 1440)
    await mode.click()
    await expect(mode).toHaveAttribute('aria-pressed', 'true')
    for (const kind of ['wall', 'furniture', 'window']) {
      await expect.poll(() => page.evaluate(kind => (window as any).transparencyTest.point(kind), kind), { timeout: 30_000 }).not.toBeNull()
      const point = await page.evaluate(kind => (window as any).transparencyTest.point(kind), kind)
      const original = await page.evaluate(ref => (window as any).transparencyTest.materials(ref), point.ref)
      if (mobile) await page.touchscreen.tap(point.x, point.y)
      else await page.mouse.click(point.x, point.y)
      await expect.poll(() => page.evaluate(ref => (window as any).transparencyTest.store.getState().transparentRefs.includes(ref), point.ref)).toBe(true)
      await expect.poll(() => page.evaluate(ref => (window as any).transparencyTest.materials(ref).every((opacity: number) => opacity === 0), point.ref)).toBe(true)
      if (kind === 'wall') await page.screenshot({ path: testInfo.outputPath('transparent-wall.png') })
      await reset.click()
      await expect.poll(() => page.evaluate(ref => (window as any).transparencyTest.materials(ref), point.ref)).toEqual(original)
      await mode.click()
    }
    const before = await page.evaluate(() => (window as any).transparencyTest.store.getState().transparentRefs)
    const canvas = await page.locator('canvas').boundingBox()
    await page.mouse.move(canvas!.width * .5, canvas!.height * .6)
    await page.mouse.down()
    await page.mouse.move(canvas!.width * .5 + 80, canvas!.height * .6 + 30, { steps: 8 })
    await page.mouse.up()
    expect(await page.evaluate(() => (window as any).transparencyTest.store.getState().transparentRefs)).toEqual(before)
    await page.screenshot({ path: testInfo.outputPath('interior-transparency.png') })
    await page.keyboard.press('Escape')
    await expect(mode).toHaveAttribute('aria-pressed', 'false')
    expect(await page.evaluate(() => JSON.stringify((window as any).transparencyTest.store.getState().project) === (window as any).transparencyTest.original)).toBe(true)
    expect(await page.evaluate(() => (window as any).transparencyTest.store.getState().history.length)).toBe(0)
    await page.getByRole('button', { name: 'Wróć do działki', exact: true }).click()
    await expect(mode).toBeVisible()
    await expect(mode).toHaveAttribute('aria-pressed', 'false')
    expect(errors).toEqual([])
  })
})

test('room view reveals through the cathedral ceiling and keeps temporary state across views', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('interior-camera/project/transparency-browser-test/house/main/storey/reference-ground/room/wide-landscape', JSON.stringify({ width: 1440, height: 1000, position: [.9, 1.6, -5.65], target: [3.9, 3.7, -2.4], zoom: 1 }))
  })
  await open(page)
  await page.getByRole('button', { name: 'Wnętrze domu', exact: true }).click()
  await page.getByRole('button', { name: 'Widok z pomieszczenia', exact: true }).click()
  await page.getByRole('button', { name: 'Przezroczystość', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as any).transparencyTest.point('ceiling')), { timeout: 30_000 }).not.toBeNull()
  const point = await page.evaluate(() => (window as any).transparencyTest.point('ceiling'))
  await page.mouse.click(point.x, point.y)
  await expect.poll(() => page.evaluate(ref => (window as any).transparencyTest.materials(ref).every((opacity: number) => opacity === 0), point.ref)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('transparent-cathedral-ceiling.png') })
  await page.getByRole('button', { name: 'Wnętrze 3D', exact: true }).click()
  await page.getByRole('button', { name: 'Widok z pomieszczenia', exact: true }).click()
  await expect.poll(() => page.evaluate(ref => (window as any).transparencyTest.materials(ref).length > 0 && (window as any).transparencyTest.materials(ref).every((opacity: number) => opacity === 0), point.ref)).toBe(true)
  await page.getByRole('button', { name: 'Przywróć widoczność', exact: true }).click()
  await expect.poll(() => page.evaluate(ref => (window as any).transparencyTest.materials(ref).some((opacity: number) => opacity > 0), point.ref)).toBe(true)
  expect(await page.evaluate(() => JSON.stringify((window as any).transparencyTest.store.getState().project) === (window as any).transparencyTest.original)).toBe(true)
})
