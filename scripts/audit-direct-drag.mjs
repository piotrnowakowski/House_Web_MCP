/**
 * Verify direct wall/furniture dragging against a built app using mouse and real touch.
 * Inputs: --url (preview or public origin), --output (evidence folder), --help.
 * Outputs: screenshots and audit.json. Uses new disposable browser profiles only.
 * Usage: node scripts/audit-direct-drag.mjs --url http://127.0.0.1:4190/
 */
import { chromium, expect } from '@playwright/test'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import assert from 'node:assert/strict'

function centre(building, room) {
  const points=room.boundary.map(use=>{const w=building.walls.find(w=>w.ref===use.wallRef);return use.direction===1?w.start:w.end})
  let area=0,x=0,z=0
  points.forEach((p,i)=>{const q=points[(i+1)%points.length],cross=p.x*q.z-q.x*p.z;area+=cross;x+=(p.x+q.x)*cross;z+=(p.z+q.z)*cross})
  return {x:x/(3*area),z:z/(3*area)}
}
async function stored(page,ref) {
  return page.evaluate(async ref=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('house-web-mcp');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
    try{return await new Promise((resolve,reject)=>{const r=db.transaction('projects').objectStore('projects').get(`workspace/${ref}`);r.onsuccess=()=>resolve(r.result?.project);r.onerror=()=>reject(r.error)})}finally{db.close()}
  },ref)
}
async function main() {
  const {values}=parseArgs({options:{url:{type:'string',default:'http://127.0.0.1:4190/'},output:{type:'string',default:'output/direct-drag-production'},help:{type:'boolean'}}})
  if(values.help){console.log('Usage: node scripts/audit-direct-drag.mjs [--url URL] [--output DIR]');return}
  const model=JSON.parse(await readFile('project-data/zielonki-v2/project.json','utf8')), building=model.buildings[0]
  await mkdir(values.output,{recursive:true});const reports=[]
  for(const touch of [false,true]) {
    const browser=await chromium.launch({channel:'chrome',headless:true})
    try {
      const context=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1440,height:1000},hasTouch:touch,isMobile:touch})
      const page=await context.newPage(), errors=[]
      page.on('pageerror',error=>errors.push(error.message))
      await page.goto(values.url,{waitUntil:'domcontentloaded',timeout:90000})
      await page.getByRole('button',{name:/^(Continue|Open) · Garaz przód$/}).click()
      await expect(page.locator('.start-screen-scrim')).not.toBeVisible()
      await page.getByRole('button',{name:'House interior',exact:true}).click()
      await page.getByRole('button',{name:'2D Plan',exact:true}).click()
      // Orthographic plan labels expose the projection without importing development-only hooks.
      const rooms=await Promise.all(['space/reference-wc','space/reference-pantry','space/reference-office'].map(async ref=>{
        const room=building.spaces.find(r=>r.ref===ref)
        const label=page.locator('.interior-room-label').filter({has:page.locator('strong',{hasText:room.name})})
        await expect(label).toBeVisible();await expect(label).toHaveCount(1)
        const box=await label.boundingBox();return {...centre(building,room),sx:box.x+box.width/2,sy:box.y+box.height/2}
      }))
      const [bath,utility,office]=rooms
      const sx=(office.sx-bath.sx)/(office.x-bath.x),sy=(utility.sy-bath.sy)/(utility.z-bath.z)
      const screen=(x,z)=>({x:bath.sx+(x-bath.x)*sx,y:bath.sy+(z-bath.z)*sy})
      const session=await context.newCDPSession(page)
      const drag=async(a,b)=>{
        if(touch){
          await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]})
          for(let i=1;i<=8;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8,id:1}]})
          await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
        }else{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up()}
      }
      await page.getByRole('button',{name:'Edit',exact:true}).click()
      await page.getByRole('button',{name:'Select walls',exact:true}).click()
      // Partition refs change when adjoining wall runs are joined or split. Use
      // the current plan's actual selectable walls instead of historical numbers.
      const wallLabels=await page.getByRole('button',{name:/^Select wall /}).evaluateAll(buttons=>buttons.map(button=>button.getAttribute('aria-label')).filter(Boolean))
      const wallRefs=wallLabels.map(label=>label.replace(/^Select wall /,'')).filter(ref=>building.walls.some(w=>w.ref===ref)).slice(0,3)
      assert.equal(wallRefs.length,3,'Direct-drag audit needs three existing ground-floor walls')
      for(const ref of wallRefs)await page.getByRole('button',{name:`Select wall ${ref}`,exact:true}).click()
      await page.getByRole('button',{name:'Group walls',exact:true}).click()
      if(await page.getByRole('button',{name:'Close panel',exact:true}).isVisible())await page.getByRole('button',{name:'Close panel',exact:true}).click()
      const movedWall=building.walls.find(w=>w.ref===wallRefs[0])
      const wallX=(movedWall.start.x+movedWall.end.x)/2,wallZ=(movedWall.start.z+movedWall.end.z)/2
      await drag(screen(wallX,wallZ),screen(wallX,wallZ+.4))
      await expect.poll(async()=> (await stored(page,model.ref))?.buildings[0].walls.find(w=>w.ref===movedWall.ref).start.z,{timeout:15000}).toBeCloseTo(movedWall.start.z+.4,2)
      if(await page.getByRole('button',{name:'Close panel',exact:true}).isVisible())await page.getByRole('button',{name:'Close panel',exact:true}).click()
      const grouped=await stored(page,model.ref)
      for(const ref of wallRefs){
        const before=building.walls.find(w=>w.ref===ref),after=grouped.buildings[0].walls.find(w=>w.ref===ref)
        assert.ok(after.groupRef)
        assert.ok(Math.abs(after.start.z-before.start.z-.4)<.01)
        assert.ok(Math.abs(after.end.z-before.end.z-.4)<.01)
      }
      const sofa=building.furniture.find(i=>i.ref==='interior/reference-sofa')
      await drag(screen(sofa.position.x-.9,sofa.position.z),screen(sofa.position.x-.5,sofa.position.z))
      await expect.poll(async()=> (await stored(page,model.ref))?.buildings[0].furniture.find(i=>i.ref===sofa.ref).position.x,{timeout:15000}).not.toBe(sofa.position.x)
      await page.screenshot({path:`${values.output}/${touch?'touch':'mouse'}.png`})
      const saved=await stored(page,model.ref)
      await page.reload({waitUntil:'domcontentloaded'})
      await page.getByRole('button',{name:/^(Continue|Open) · Garaz przód$/}).click()
      await expect(page.locator('.start-screen-scrim')).not.toBeVisible({timeout:30000})
      assert.deepEqual(await stored(page,model.ref),saved);assert.deepEqual(errors,[])
      reports.push({input:touch?'touch':'mouse',passed:true,checks:['wall grouping and rigid group drag','first-contact furniture drag','reload','no page errors']})
      await writeFile(`${values.output}/audit.json`,JSON.stringify({url:values.url,reports},null,2)+'\n')
      console.log(`${touch?'touch':'mouse'}: passed`)
    } finally {await browser.close()}
  }
}
main().catch(error=>{console.error(error);process.exitCode=1})
