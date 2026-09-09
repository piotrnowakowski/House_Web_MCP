import { expect, test, type Page } from '@playwright/test'

const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5187'
const harness = '/tests/browser-harness.ts'
async function read(page: Page) {
  return page.evaluate(async (url) => (await import(/* @vite-ignore */ url)).state(), harness)
}
async function camera(page: Page) {
  return page.evaluate(async (url) => (await import(/* @vite-ignore */ url)).camera(), harness)
}
async function point(page: Page, x: number, z: number, y = 0) {
  return page.evaluate(async ({ url, x, z, y }) => (await import(/* @vite-ignore */ url)).point(x, z, y), {
    url: harness,
    x,
    z,
    y,
  })
}
async function clickPoint(page: Page, x: number, z: number, y = 0) {
  const p = await point(page, x, z, y)
  await page.mouse.click(p.x, p.y)
}
async function start(page: Page) {
  await page.addInitScript(() => {
    const tools: Record<string, unknown> = {}
    Object.assign(window, { __interiorTools: tools })
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool: async (tool: { name: string }) => {
          tools[tool.name] = tool
        },
      },
    })
  })
  await page.goto(appUrl)
  await page.getByRole('dialog', { name: 'Where do you want to plan today?' }).waitFor()
  await page.evaluate(async (url) => (await import(/* @vite-ignore */ url)).fixture(), harness)
  await page.getByRole('button', { name: 'House interior', exact: true }).click()
  await page.getByRole('button', { name: '2D Plan', exact: true }).click()
  await page.waitForTimeout(350)
}
async function choose(page: Page, name = 'LACK Coffee table') {
  if (await page.getByRole('button', { name: 'Close panel', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Close panel', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search furniture' }).fill(name.split(' ')[0])
  await page.getByRole('button', { name: `Place ${name}`, exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Furniture & fittings' })).toBeHidden()
}

// The new controls replace the legacy always-open inspector; all editing below uses public UI.
for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`dimensions window ${viewport.width}: catalogue minimum, cancel, rendered enlargement and history`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width < 600,
      hasTouch: viewport.width < 600,
    })
    const page = await context.newPage()
    try {
      await start(page)
      await choose(page)
      await clickPoint(page, -3, 2)
      await expect.poll(async () => (await read(page)).project.buildings[0].furniture?.length).toBe(1)
      await page.getByRole('button', { name: 'Edit', exact: true }).click()
      const pencil = page.getByRole('button', { name: 'Edit dimensions', exact: true })
      const dialog = page.getByRole('dialog', { name: 'Dimensions', exact: true })
      const width = dialog.getByRole('spinbutton', { name: 'Width (m)', exact: true })
      const before = await read(page)
      const beforeCamera = await camera(page)
      await expect(page.getByRole('spinbutton', { name: 'Width (m)', exact: true })).toHaveCount(0)
      await pencil.click()
      await expect(width).toHaveValue('0.9')
      await expect(width).toHaveAttribute('min', '0.9')
      await expect(dialog.getByRole('slider')).toHaveCount(0)
      expect(await camera(page)).toEqual(beforeCamera)
      const bounds = await dialog.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.y).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width)
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height)
      await page.screenshot({ path: `output/interior-editor/dimensions-${viewport.width}.png` })
      await width.fill('1.2')
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
      expect((await read(page)).history).toBe(before.history)
      await expect(pencil).toBeFocused()
      await pencil.click()
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(pencil).toBeVisible()
      await pencil.click()
      await width.fill('0.8')
      await dialog.getByRole('button', { name: 'Save dimensions', exact: true }).click()
      await expect(dialog).toBeVisible()
      expect((await read(page)).history).toBe(before.history)
      await width.fill('20')
      await dialog.getByRole('button', { name: 'Save dimensions', exact: true }).click()
      await expect(dialog.getByRole('alert')).toBeVisible()
      expect((await read(page)).history).toBe(before.history)
      await width.fill('1.2')
      await dialog.getByRole('spinbutton', { name: 'Depth (m)', exact: true }).fill('0.7')
      await dialog.getByRole('spinbutton', { name: 'Height (m)', exact: true }).fill('0.6')
      await dialog.getByRole('button', { name: 'Save dimensions', exact: true }).click()
      await expect(dialog).toHaveCount(0)
      const enlarged = (await read(page)).project.buildings[0].furniture[0]
      expect(enlarged).toMatchObject({ widthM: 1.2, depthM: 0.7, heightM: 0.6 })
      expect((await read(page)).history).toBe(before.history + 1)
      await expect
        .poll(async () =>
          page.evaluate(
            async ({ url, ref }) => {
              const size = (await import(/* @vite-ignore */ url)).modelSize(ref)
              return size?.map((value: number) => +value.toFixed(3))
            },
            { url: harness, ref: enlarged.ref },
          ),
        )
        .toEqual([1.2, 0.6, 0.7])
      await page.getByRole('button', { name: 'Close panel', exact: true }).click()
      if (viewport.width < 600) await page.getByRole('button', { name: 'More', exact: true }).click()
      await page.getByRole('button', { name: 'Undo', exact: true }).click()
      expect((await read(page)).project.buildings[0].furniture[0].widthM).toBe(0.9)
      await page.getByRole('button', { name: 'Redo', exact: true }).click()
      await page.waitForTimeout(600)
      await page.reload()
      await page.getByRole('button', { name: /Continue · Interior browser study/ }).click()
      await page.getByRole('button', { name: 'House interior', exact: true }).click()
      expect((await read(page)).project.buildings[0].furniture[0]).toMatchObject({
        widthM: 1.2,
        depthM: 0.7,
        heightM: 0.6,
      })
    } finally {
      await context.close()
    }
  })
}

test('desktop furniture placement, precision, grouped history, cancellation and autosave', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await start(page)
  await choose(page)
  await clickPoint(page, -3, 2)
  await expect.poll(async () => (await read(page)).project.buildings[0].furniture?.length).toBe(1)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Width (m)', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit dimensions', exact: true })).toBeVisible()
  await expect(page.getByRole('slider')).toHaveCount(0)
  await page.getByRole('button', { name: 'Adjust Rotation (°)', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Rotation (°) slider' })).toBeVisible()
  await page.getByRole('spinbutton', { name: 'Rotation (°)', exact: true }).fill('30')
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click()
  await expect.poll(async () => (await read(page)).project.buildings[0].furniture[0].rotationDegrees).toBe(30)
  await page.getByRole('button', { name: 'Close panel', exact: true }).click()
  const from = await point(page, -3, 2, 0.45),
    to = await point(page, -2.4, 2, 0.45)
  const old = await read(page)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await read(page)).history).toBe(old.history + 1)
  const moved = await read(page)
  expect(moved.project.buildings[0].furniture[0].position.x).toBeCloseTo(-2.4, 1)
  if (await page.getByRole('button', { name: 'Close panel' }).isVisible())
    await page.getByRole('button', { name: 'Close panel' }).click()
  const pos = moved.project.buildings[0].furniture[0].position
  const a = await point(page, pos.x, pos.z, 0.45)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(a.x + 35, a.y + 10, { steps: 5 })
  await page.locator('canvas').dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' })
  await page.mouse.up()
  expect((await read(page)).history).toBe(moved.history)
  if (await page.getByRole('button', { name: 'Close panel' }).isVisible())
    await page.getByRole('button', { name: 'Close panel' }).click()
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click()
  await expect.poll(async () => (await read(page)).project.buildings[0].furniture.length).toBe(2)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect((await read(page)).project.buildings[0].furniture).toHaveLength(1)
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  expect((await read(page)).project.buildings[0].furniture).toHaveLength(2)
  await page.waitForTimeout(600)
  await page.reload()
  await page.getByRole('button', { name: /Continue · Interior browser study/ }).click()
  await page.getByRole('button', { name: 'House interior', exact: true }).click()
  expect((await read(page)).project.buildings[0].furniture).toHaveLength(2)
  await page.screenshot({ path: 'output/interior-editor/desktop-edited.png' })
  expect(errors).toEqual([])
})

test('room partition, opening, wall finishes, merge and dimension edit work through the inspector', async ({
  page,
}) => {
  await start(page)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page
    .getByRole('region', { name: 'Rooms on this level' })
    .getByRole('button', { name: 'Kitchen and studio', exact: true })
    .click()
  await page.getByRole('textbox', { name: 'Room name', exact: true }).fill('Kitchen & work')
  await page.getByRole('spinbutton', { name: 'Room width (m)', exact: true }).fill('5.76')
  await page.getByRole('button', { name: 'Save room', exact: true }).click()
  await page.getByRole('button', { name: 'Draw partition in this room', exact: true }).click()
  await clickPoint(page, -6, -1.5)
  await clickPoint(page, 0, -1.5)
  await expect.poll(async () => (await read(page)).project.buildings[0].spaces.length).toBe(3)
  await clickPoint(page, -3, -1.5, 0.14)
  await expect(page.getByRole('heading', { name: 'Partition wall', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add door', exact: true }).click()
  await page.getByLabel('Door hinge', { exact: true }).selectOption('right')
  await page.getByLabel('Door swing', { exact: true }).selectOption('out')
  await page.getByRole('button', { name: 'Save opening', exact: true }).click()
  await page.getByRole('button', { name: 'Remove opening', exact: true }).click()
  await page.getByRole('button', { name: 'Close panel', exact: true }).click()
  await clickPoint(page, -2, -1.5, 0.14)
  await page.getByRole('button', { name: 'Finish Soft sage', exact: true }).click()
  await page.getByRole('button', { name: 'Apply finish', exact: true }).click()
  const wall = (await read(page)).project.buildings[0].walls.find((w: { faceFinishes?: unknown }) => w.faceFinishes)
  expect(wall.faceFinishes.left.presetId).toBe('sage')
  expect(wall.faceFinishes.right).toBeUndefined()
  await page.getByRole('button', { name: 'Remove partition & merge rooms', exact: true }).click()
  await expect.poll(async () => (await read(page)).project.buildings[0].spaces.length).toBe(2)
})

for (const size of [
  { width: 360, height: 640, visible: 0.8 },
  { width: 390, height: 844, visible: 0.85 },
  { width: 844, height: 390, visible: 0.7 },
]) {
  test(`mobile ${size.width}×${size.height}: visibility, sheet, touch, precision and plot controls`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: size, isMobile: true, hasTouch: true })
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    try {
      await start(page)
      const bounds = await page.locator('canvas').boundingBox()
      expect(bounds?.width).toBe(size.width)
      expect(bounds?.height).toBe(size.height)
      const top = await page.locator('.interior-header').boundingBox(),
        bottom = await page.locator('.interior-action-bar').boundingBox()
      expect((size.height - top!.height - bottom!.height) / size.height).toBeGreaterThanOrEqual(size.visible)
      const before = await camera(page)
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await page.waitForTimeout(250)
      expect(await camera(page)).toEqual(before)
      expect(await page.getByRole('dialog', { name: 'Furniture & fittings' }).count()).toBe(1)
      await page.getByRole('button', { name: 'Expand panel', exact: true }).click()
      await page.getByRole('searchbox', { name: 'Search furniture' }).fill('LACK')
      await page.getByRole('button', { name: 'Place LACK Coffee table', exact: true }).click()
      const p = await point(page, -3, 2)
      await page.touchscreen.tap(p.x, p.y)
      await expect.poll(async () => (await read(page)).project.buildings[0].furniture?.length).toBe(1)
      const touch = await context.newCDPSession(page)
      const origin = await point(page, -3, 2, 0.45)
      const destination = await point(page, -2.6, 2, 0.45)
      const beforeDrag = await read(page)
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: origin.x, y: origin.y, id: 1 }],
      })
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: destination.x, y: destination.y, id: 1 }],
      })
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await expect.poll(async () => (await read(page)).history).toBe(beforeDrag.history + 1)
      const afterDrag = await read(page)
      const actual = afterDrag.project.buildings[0].furniture[0].position
      const actualScreen = await point(page, actual.x, actual.z, 0.45)
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: actualScreen.x, y: actualScreen.y, id: 1 }],
      })
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: actualScreen.x + 10, y: actualScreen.y + 10, id: 1 }],
      })
      await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
      expect((await read(page)).history).toBe(afterDrag.history)
      await page.getByRole('button', { name: 'Rotate', exact: true }).click()
      await page.getByRole('button', { name: 'Edit', exact: true }).click()
      await page.getByRole('button', { name: 'Expand panel', exact: true }).click()
      await expect(page.getByRole('slider')).toHaveCount(0)
      await page.getByRole('button', { name: 'Adjust Elevation (m)', exact: true }).click()
      await page.getByRole('spinbutton', { name: 'Elevation (m)', exact: true }).fill('0.1')
      await page.getByRole('button', { name: 'Apply changes', exact: true }).click()
      expect((await read(page)).project.buildings[0].furniture[0].elevationM).toBe(0.1)
      await page.getByRole('button', { name: 'Close panel', exact: true }).click()
      await page.getByRole('button', { name: 'More', exact: true }).click()
      await page.getByRole('button', { name: 'Hide controls', exact: true }).click()
      await expect(page.locator('.interior-action-bar')).toHaveCount(0)
      await page.getByRole('button', { name: 'Show controls', exact: true }).click()
      await page.getByRole('button', { name: 'Back to plot', exact: true }).click()
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.getByRole('dialog', { name: 'Garden fixtures', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Fit plot view', exact: true }).click()
      await page.waitForTimeout(1500)
      const fitted = await point(page, 0, 0, 1.5)
      const sheet = (await page.locator('.adaptive-sheet').boundingBox())!
      expect(fitted.y).toBeGreaterThan(56)
      if (size.width < size.height) expect(fitted.y).toBeLessThan(sheet.y)
      else expect(fitted.x).toBeLessThan(sheet.x)
      await page.getByRole('button', { name: 'Close panel', exact: true }).click()
      const plotTop = await page.locator('.plot-compact-top').boundingBox(),
        plotBottom = await page.locator('.plot-action-bar').boundingBox()
      expect((size.height - plotTop!.height - plotBottom!.height) / size.height).toBeGreaterThanOrEqual(size.visible)
      await page.waitForTimeout(5000)
      await page.screenshot({ path: `output/interior-editor/plot-${size.width}.png` })
      await page.getByRole('button', { name: 'House interior', exact: true }).click()
      await page.waitForTimeout(400)
      await page.screenshot({ path: `output/interior-editor/interior-${size.width}.png` })
      expect(errors).toEqual([])
    } finally {
      await context.close()
    }
  })
}

test('WebMCP interior changes remain proposals until Apply or Reject in the interior view', async ({ page }) => {
  await start(page)
  const result = await page.evaluate(async () => {
    const tools = (window as any).__interiorTools
    return JSON.parse(
      (
        await tools.propose_change.execute({
          operations: [
            {
              type: 'interior.update',
              action: 'room',
              buildingRef: 'house/main',
              storeyRef: 'storey/ground',
              spaceRef: 'space/living',
              name: 'Proposed room name',
            },
          ],
        })
      ).content[0].text,
    )
  })
  expect(result.status).toBe('variant_created')
  expect((await read(page)).project.buildings[0].spaces.find((r: any) => r.ref === 'space/living').name).toBe(
    'Living room',
  )
  await page.evaluate((variantRef) => {
    void (window as any).__interiorTools.manage_variant.execute({ action: 'request-apply', variantRef })
  }, result.variantRef)
  await page.getByRole('button', { name: 'Apply complete variant', exact: true }).click()
  expect((await read(page)).project.buildings[0].spaces.find((r: any) => r.ref === 'space/living').name).toBe(
    'Proposed room name',
  )
})

test('failed IKEA GLB stays selectable with accurate dimensions and retry', async ({ page }) => {
  await page.route('**/models/interior/lack.glb', (route) => route.abort())
  await start(page)
  await choose(page)
  await clickPoint(page, -3, 2)
  await expect(page.getByRole('button', { name: 'Model unavailable · Retry', exact: true })).toBeVisible()
  const item = (await read(page)).project.buildings[0].furniture[0]
  expect([item.widthM, item.depthM, item.heightM]).toEqual([0.9, 0.55, 0.45])
  await page.unroute('**/models/interior/lack.glb')
  await page.getByRole('button', { name: 'Model unavailable · Retry', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Model unavailable · Retry', exact: true })).toBeHidden()
})

test('project alternatives and downloads preserve the original and printable plan', async ({ page }) => {
  await start(page)
  await choose(page)
  await clickPoint(page, -3, 2)
  await page.getByRole('button', { name: 'More', exact: true }).click()
  const before = await read(page)
  const jsonDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export project JSON', exact: true }).click()
  expect((await jsonDownload).suggestedFilename()).toBe('house-project.json')
  const pngDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export scene PNG', exact: true }).click()
  expect((await pngDownload).suggestedFilename()).toBe('interior-scene.png')
  const csvDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export furniture list', exact: true }).click()
  expect((await csvDownload).suggestedFilename()).toBe('furniture-list.csv')
  const popup = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Print dimensioned plan / PDF', exact: true }).click()
  const plan = await popup
  await expect(plan.locator('svg')).toBeVisible()
  await expect(plan.locator('table')).toContainText('90449905')
  await plan.pdf({ path: 'output/interior-editor/dimensioned-plan.pdf', format: 'A4', landscape: true })
  await plan.close()
  await page.getByRole('button', { name: 'Duplicate project for an alternative', exact: true }).click()
  await expect.poll(async () => (await read(page)).project.ref).not.toBe(before.project.ref)
  const after = await read(page)
  expect(after.project.buildings).toEqual(before.project.buildings)
  await page.getByLabel('Import interior project file').setInputFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(before.project)),
  })
  await expect.poll(async () => (await read(page)).project.name).toBe('Interior browser study — imported')
})
