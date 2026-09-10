import { test, expect } from '@playwright/test'

for (const touch of [false, true]) test(`slide a wall past the room junction with ${touch ? 'touch' : 'mouse'}`, async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: touch ? { width: 844, height: 650 } : { width: 1440, height: 1000 }, hasTouch: touch, isMobile: touch })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5173/')
    await page.getByRole('dialog', { name: 'Where do you want to plan today?' }).waitFor()
    await page.evaluate(async () => (await import('/tests/browser-harness.ts')).dragFixture())
    await page.getByRole('button', { name: 'House interior', exact: true }).click()
    await page.getByRole('button', { name: '2D Plan', exact: true }).click()
    await page.waitForTimeout(600)
    const read = () => page.evaluate(async () => (await import('/tests/browser-harness.ts')).state())
    const before = await read()
    const points = await page.evaluate(async () => {
      const harness = await import('/tests/browser-harness.ts')
      return { a: harness.point(1.4, 4, .18), b: harness.point(1.4, 2.6, .18) }
    })
    if (touch) {
      const cdp = await context.newCDPSession(page)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...points.a, id: 1 }] })
      for (let step = 1; step <= 10; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: points.a.x + (points.b.x - points.a.x) * step / 10, y: points.a.y + (points.b.y - points.a.y) * step / 10, id: 1 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    } else {
      await page.mouse.move(points.a.x, points.a.y); await page.mouse.down()
      await page.mouse.move(points.b.x, points.b.y, { steps: 10 }); await page.mouse.up()
    }
    await expect.poll(async () => (await read()).history).toBe(before.history + 1)
    const moved = await read(), building = moved.project.buildings[0]
    const wall = building.walls.find((wall: { ref: string }) => wall.ref === 'wall/carport-layout/ground/5')!
    expect(wall.start.z).toBeCloseTo(2.6, 1); expect(wall.end.z).toBeCloseTo(2.6, 1)
    expect(building.roof).toEqual(before.project.buildings[0].roof)
    for (const wall of building.walls.filter((wall: { ref: string }) => building.storeys[0].wallRefs.includes(wall.ref))) {
      expect(Math.min(Math.abs(wall.start.x - wall.end.x), Math.abs(wall.start.z - wall.end.z))).toBeLessThan(.0001)
    }
    await page.getByRole('button', { name: '3D Interior', exact: true }).click()
    await page.screenshot({ path: testInfo.outputPath('moved-wall.png') })
    await page.keyboard.press('Control+z')
    expect((await read()).project).toEqual(before.project)
    await page.keyboard.press('Control+Shift+z')
    expect((await read()).project).toEqual(moved.project)
    await page.waitForTimeout(650)
    await page.reload()
    await page.getByRole('button', { name: /Continue · Interior drag test/ }).click()
    await expect(page.getByRole('dialog', { name: 'Where do you want to plan today?' })).toBeHidden()
    expect((await read()).project).toEqual(moved.project)
    expect(errors).toEqual([])
  } finally { await context.close() }
})
