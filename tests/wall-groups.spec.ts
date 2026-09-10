import { test, expect, type Page } from '@playwright/test'
const harness = '/tests/browser-harness.ts'
const read = (page: Page) => page.evaluate(async url => (await import(/* @vite-ignore */ url)).state(), harness)
const point = (page: Page, x: number, z: number) => page.evaluate(async ({ url, x, z }) => (await import(/* @vite-ignore */ url)).point(x, z, .18), { url: harness, x, z })
const refs = [7,6,5].map(i => `wall/carport-layout/ground/${i}`)
for (const touch of [false,true]) test(`wall groups: ${touch ? 'touch' : 'mouse'} selection, drag, undo, reload and ungroup`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: touch ? {width:844,height:650} : {width:1440,height:1000}, hasTouch:touch,isMobile:touch })
  const page = await context.newPage(), cdp = await context.newCDPSession(page)
  const close = async () => { const button=page.getByRole('button',{name:'Close panel',exact:true}); if(await button.isVisible())await button.click() }
  try {
    await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5173/')
    await page.getByRole('dialog',{name:'Where do you want to plan today?'}).waitFor()
    await page.evaluate(async url => (await import(/* @vite-ignore */ url)).dragFixture(),harness)
    await page.getByRole('button',{name:'House interior',exact:true}).click()
    await page.getByRole('button',{name:'2D Plan',exact:true}).click()
    await page.getByRole('button',{name:'Edit',exact:true}).click()
    await page.getByRole('button',{name:'Select walls',exact:true}).click()
    for(const ref of refs)await page.getByRole('button',{name:`Select wall ${ref}`,exact:true}).click()
    const initial=await read(page)
    await page.getByRole('button',{name:'Group walls',exact:true}).click()
    await expect.poll(async()=> (await read(page)).history).toBe(initial.history+1)
    let state=await read(page)
    const group=state.project.buildings[0].walls.find((w:{ref:string})=>w.ref===refs[0]).groupRef
    expect(group).toBeTruthy()
    for(const ref of refs)expect(state.project.buildings[0].walls.find((w:{ref:string})=>w.ref===ref).groupRef).toBe(group)
    await close()
    const a=await point(page,-4.95,3.415),b=await point(page,-4.95,3.615)
    if(touch){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]})
      for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/6,y:a.y+(b.y-a.y)*i/6,id:1}]})
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
    }else{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:6});await page.mouse.up()}
    await expect.poll(async()=> (await read(page)).history).toBe(initial.history+2)
    const moved=await read(page)
    for(const ref of refs){
      const before=state.project.buildings[0].walls.find((w:{ref:string})=>w.ref===ref),after=moved.project.buildings[0].walls.find((w:{ref:string})=>w.ref===ref)
      expect(after.start.z).toBeCloseTo(before.start.z+.2)
      expect(after.end.z).toBeCloseTo(before.end.z+.2)
    }
    if(touch)await page.getByRole('button',{name:'More',exact:true}).click()
    await page.getByRole('button',{name:'Undo',exact:true}).click()
    expect((await read(page)).project).toEqual(state.project)
    await page.getByRole('button',{name:'Redo',exact:true}).click()
    expect((await read(page)).project).toEqual(moved.project)
    await page.waitForTimeout(700)
    await page.reload()
    await page.getByRole('button',{name:/Continue · Interior drag test/}).click()
    await expect(page.locator('.start-screen-scrim')).not.toBeVisible({timeout:30000})
    expect((await read(page)).project).toEqual(moved.project)
    await page.getByRole('button',{name:'House interior',exact:true}).click()
    await page.getByRole('button',{name:'Edit',exact:true}).click()
    await page.getByRole('button',{name:'Select walls',exact:true}).click()
    await page.getByRole('button',{name:`Select wall ${refs[0]}`,exact:true}).click()
    await expect(page.getByRole('heading',{name:'Wall groups · 3 selected'})).toBeVisible()
    await page.screenshot({path:`output/wall-groups/${touch?'touch':'mouse'}.png`})
    await page.getByRole('button',{name:'Ungroup walls',exact:true}).click()
    state=await read(page)
    expect(state.project.buildings[0].walls.filter((w:{ref:string})=>refs.includes(w.ref)).every((w:{groupRef?:string})=>!w.groupRef)).toBe(true)
  }catch(error){await page.screenshot({path:`output/wall-groups/failure-${touch}.png`});throw error}
  finally{await context.close()}
})
