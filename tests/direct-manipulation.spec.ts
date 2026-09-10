import { test, expect, type Page } from '@playwright/test'

const harness = '/tests/browser-harness.ts'
const read = (page: Page) => page.evaluate(async url => (await import(/* @vite-ignore */ url)).state(), harness)
const camera = (page: Page) => page.evaluate(async url => (await import(/* @vite-ignore */ url)).camera(), harness)
const point = (page: Page, x: number, z: number, y = .18) => page.evaluate(async ({ url, x, z, y }) => (await import(/* @vite-ignore */ url)).point(x, z, y), { url: harness, x, z, y })

for (const touch of [false, true]) test(`direct ${touch ? 'touch' : 'mouse'}: walls, openings, first-contact furniture and cancellation`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: touch ? { width: 844, height: 650 } : { width: 1440, height: 1000 }, hasTouch: touch, isMobile: touch })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  const drag = async (a: { x: number; y: number }, b: { x: number; y: number }, cancel = false) => {
    if (touch) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...a, id: 1 }] })
      for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x-a.x)*i/6, y: a.y+(b.y-a.y)*i/6, id: 1 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] })
    } else {
      await page.mouse.move(a.x,a.y); await page.mouse.down(); await page.mouse.move(b.x,b.y,{ steps: 6 })
      if (cancel) await page.keyboard.press('Escape')
      await page.mouse.up()
    }
    await page.waitForTimeout(200)
  }
  try {
    await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5173/')
    await page.getByRole('dialog', { name: 'Where do you want to plan today?' }).waitFor()
    await page.evaluate(async url => (await import(/* @vite-ignore */ url)).dragFixture(), harness)
    await page.getByRole('button', { name: 'House interior', exact: true }).click()
    await page.getByRole('button', { name: '2D Plan', exact: true }).click()
    await page.waitForTimeout(600)
    const initial = await read(page), beforeCamera = await camera(page)
    const wallRef = 'wall/carport-layout/ground/7'
    await drag(await point(page,-4.95,3.415),await point(page,-4.95,3.715))
    await expect.poll(async () => (await read(page)).history).toBe(initial.history+1)
    let state = await read(page)
    expect(state.project.buildings[0].walls.find((w: {ref:string}) => w.ref===wallRef).start.z).toBeCloseTo(3.715,2)
    expect(await camera(page)).toEqual(beforeCamera)
    const afterWall = state.project
    await drag(await point(page,-4.95,3.715),await point(page,-4.95,3.915),true)
    expect((await read(page)).project).toEqual(afterWall)
    if (await page.getByRole('button', { name: 'Close panel', exact: true }).isVisible()) await page.getByRole('button', { name: 'Close panel', exact: true }).click()
    // Pick the sofa seat directly, with no preceding selection tap.
    const item = state.project.buildings[0].furniture.find((i: {ref:string}) => i.ref==='interior/reference-sofa')
    await page.screenshot({ path: `output/direct-drag/before-item-${touch}.png` })
    await drag(await point(page,item.position.x-.9,item.position.z,.45), await point(page,item.position.x-.6,item.position.z,.45))
    await expect.poll(async () => (await read(page)).history).toBe(initial.history+2)
    state=await read(page)
    expect(state.project.buildings[0].furniture.find((i: {ref:string}) => i.ref===item.ref).position.x).not.toBe(item.position.x)
    expect(await camera(page)).toEqual(beforeCamera)
    if (await page.getByRole('button', { name: 'Close panel', exact: true }).isVisible()) await page.getByRole('button', { name: 'Close panel', exact: true }).click()
    const host=state.project.buildings[0].walls.find((w: {openings:{ref:string}[]})=>w.openings.some(o=>o.ref==='opening/reference-office-window'))
    const opening=host.openings.find((o:{ref:string})=>o.ref==='opening/reference-office-window')
    const length=Math.hypot(host.end.x-host.start.x,host.end.z-host.start.z), ux=(host.end.x-host.start.x)/length, uz=(host.end.z-host.start.z)/length
    const ox=host.start.x+ux*opening.offsetM, oz=host.start.z+uz*opening.offsetM
    await drag(await point(page,ox,oz,.08),await point(page,ox+ux*.2,oz+uz*.2,.08))
    await expect.poll(async () => (await read(page)).history).toBe(initial.history+3)
    await page.screenshot({ path: `output/direct-drag/${touch ? 'touch' : 'mouse'}.png` })
    // An impossible partition move must not leave preview geometry or a history entry.
    if (await page.getByRole('button', { name: 'Close panel', exact: true }).isVisible()) await page.getByRole('button', { name: 'Close panel', exact: true }).click()
    const beforeInvalid=await read(page)
    await drag(await point(page,-4.95,3.715),await point(page,-4.95,7.5))
    expect((await read(page)).project).toEqual(beforeInvalid.project)
    expect((await read(page)).history).toBe(beforeInvalid.history)
    if (touch) {
      const a=await point(page,-4.95,3.715), b=await point(page,-4.95,4.015)
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]})
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...b,id:1}]})
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...b,id:1},{x:b.x+40,y:b.y,id:2}]})
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
      expect((await read(page)).project).toEqual(beforeInvalid.project)
      await page.getByRole('button',{name:'More',exact:true}).click()
    }
    await page.getByRole('button',{name:'Undo',exact:true}).click()
    expect((await read(page)).history).toBe(initial.history+2)
    await page.getByRole('button',{name:'Redo',exact:true}).click()
    expect((await read(page)).project).toEqual(beforeInvalid.project)
    await page.waitForTimeout(650)
    await page.reload()
    await page.getByRole('button',{name:/Continue · Interior drag test/}).click()
    await expect(page.locator('.start-screen-scrim')).not.toBeVisible()
    expect((await read(page)).project).toEqual(beforeInvalid.project)
  } catch (error) { await page.screenshot({ path: `output/direct-drag/failure-${touch}.png` }); throw error }
  finally { await context.close() }
})
