import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import data from '../../project-data/architekt-7-11/project.json'
import previousInterior from '../../project-data/architekt-7-11/before-interior-r1.json'
import previousDirection from '../../project-data/architekt-7-11/before-stair-direction-r2.json'
import previousJoinery from '../../project-data/architekt-7-11/before-under-stair-r4.json'
import previousWindow from '../../project-data/architekt-7-11/before-fireplace-window-r3.json'
import source from '../../project-data/architekt/project.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { polygonBounds, spaceFootprint } from '../domain/geometry'
import { roofWings, gableRoofJunction, gableWallsForBuilding } from '../domain/roofWings'
import { gableGlazingProfile } from '../domain/gableGlazing'
import { roofWindowLayout } from '../domain/roofWindows'
import { ceilingGeometry } from '../interior/ceilingGeometry'
import { clippedRoofBox } from '../geometry/roofJunction'
import { roofWindowCutouts } from '../scene/RoofWindows'
import { ARCHITEKT_711_REF, synchronizePublishedArchitekt711 } from './publishedArchitekt711'
import { saveWorkspace, loadWorkspace, deleteWorkspace } from './persistence'
import { uStairHeadroom, uStairSurfaces } from '../domain/stairs'
import { interiorCorners } from '../domain/interior'
import { mergeProjects } from '../domain/projectMerge'
import { slopedCabinetGeometry } from '../interior/cabinetGeometry'

beforeEach(()=>{globalThis.indexedDB=new IDBFactory()})

it('widens the kitchen window towards the living room and leaves the new fireplace clear of glazing and furniture',()=>{
  const p=parseProject(data), before=parseProject(previousWindow), h=p.buildings[0], old=before.buildings[0]
  const wall=h.walls.find(w=>w.ref==='wall/architekt/ground/18')!, opening=wall.openings.find(o=>o.ref==='opening/reference-kitchen')!
  const prior=old.walls.find(w=>w.ref===wall.ref)!.openings.find(o=>o.ref===opening.ref)!
  expect(opening.offsetM-opening.widthM/2).toBeCloseTo(prior.offsetM-prior.widthM/2)
  expect(opening.widthM).toBe(3);expect(opening.heightM).toBe(prior.heightM)
  expect(opening.offsetM+opening.widthM/2).toBeLessThan(Math.hypot(wall.end.x-wall.start.x,wall.end.z-wall.start.z))
  const fireplace=h.furniture!.find(f=>f.catalogId==='fireplace')!, bounds=polygonBounds(interiorCorners(fireplace))
  expect(bounds.minX-(wall.start.x+opening.offsetM+opening.widthM/2)).toBeCloseTo(.37)
  expect(bounds.minZ).toBeCloseTo(wall.start.z+wall.thicknessM/2)
  expect(fireplace.heightM).toBe(h.storeys[0].clearHeightM)
  for(const item of h.furniture!.filter(f=>f.ref!==fireplace.ref&&f.storeyRef===fireplace.storeyRef)){
    const other=polygonBounds(interiorCorners(item))
    expect(other.maxX<=bounds.minX||other.minX>=bounds.maxX||other.maxZ<=bounds.minZ||other.minZ>=bounds.maxZ).toBe(true)
  }
  // The approved change must not roll back r3's stairs, island sink, roof or landscape.
  const revisedRefs=['interior/reference-island','interior/architekt-711/stair-junction-filler','interior/architekt-711/under-stair-cabinet',fireplace.ref]
  expect(h.furniture!.filter(f=>!revisedRefs.includes(f.ref))).toEqual(old.furniture!.filter(f=>!revisedRefs.includes(f.ref)))
  expect(h.walls.filter(w=>w.ref!==wall.ref&&w.ref!=='wall/architekt/ground/12')).toEqual(old.walls.filter(w=>w.ref!==wall.ref&&w.ref!=='wall/architekt/ground/12'))
  expect({...wall,openings:[]}).toEqual({...old.walls.find(w=>w.ref===wall.ref),openings:[]})
  for(const key of ['stairs','roof','storeys','slabs','spaces'] as const) expect(h[key]).toEqual(old[key])
  expect(p.site).toEqual(before.site);expect(p.landscape).toEqual(before.landscape);expect(p.buildings.slice(1)).toEqual(before.buildings.slice(1))
  expect(validateProject(p).filter(i=>i.severity==='error')).toEqual([])
})

it('migrates the fireplace and window from r3 while retaining deletions and exposing competing window edits',async()=>{
  const old=parseProject(previousWindow), local=structuredClone(old)
  local.landscape.plants.pop()
  local.buildings[0].furniture=local.buildings[0].furniture!.filter(f=>f.ref!=='interior/reference-stool-two')
  await saveWorkspace({version:1,project:local,proposals:[],draftChangeSets:[]})
  // Recreate the already acknowledged published baseline, as an existing r3 browser has it.
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('house-web-mcp',2);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(old,'published-base/'+old.ref);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})
  db.close()
  expect(await synchronizePublishedArchitekt711()).toEqual([])
  const saved=(await loadWorkspace(old.ref))!
  expect(saved.project.landscape).toEqual(local.landscape)
  expect(saved.project.buildings[0].furniture!.some(f=>f.ref==='interior/reference-stool-two')).toBe(false)
  expect(saved.project.buildings[0].furniture!.some(f=>f.catalogId==='fireplace')).toBe(true)
  expect(saved.project.buildings[0].walls).toEqual(parseProject(data).buildings[0].walls)
  await synchronizePublishedArchitekt711();expect(await loadWorkspace(old.ref)).toEqual(saved)
  local.buildings[0].walls.flatMap(w=>w.openings).find(o=>o.ref==='opening/reference-kitchen')!.widthM=2.7
  expect(mergeProjects(old,local,parseProject(data)).conflicts.some(p=>p.endsWith('/widthM'))).toBe(true)
})

it('opens the stair to the hall, leaves only the pantry attachment and fits the original floor aperture',()=>{
  const h=parseProject(data).buildings[0], before=parseProject(previousInterior).buildings[0], s=h.stairs![0]
  const rise=h.storeys[1].elevationM-h.storeys[0].elevationM
  const surfaces=uStairSurfaces(s,rise), first=surfaces.find(t=>Math.abs(t.top-rise/s.steps)<1e-8)!, last=surfaces.find(t=>Math.abs(t.top-(rise-rise/s.steps))<1e-8)!
  expect(s.uTurn?.entrySide).toBe('max-z')
  expect(first.z).toBeGreaterThan(last.z) // Entrance/hol is south; pantry and kitchen are north.
  const previous=uStairSurfaces(parseProject(previousDirection).buildings[0].stairs![0],rise)
  surfaces.forEach((surface,i)=>{expect(surface.top).toBe(previous[i].top);expect(surface.x).toBe(previous[i].x);expect(surface.z+previous[i].z).toBeCloseTo(2)})
  expect(s.finish).toEqual({treadColor:'#F0EEE9',closedRisers:true,railing:'glass'})
  expect(rise/s.steps).toBeCloseTo(3.25/18)
  expect(s.runM/(s.steps/2-1)).toBeCloseTo(.27)
  const hole=polygonBounds(h.slabs[1].holes![0])
  expect(s.start.x-hole.minX).toBeCloseTo(.03)
  expect(s.start.x+s.runM+s.uTurn!.landingDepthM).toBeCloseTo(hole.maxX)
  for(const surface of uStairSurfaces(s,rise)) {
    expect(s.start.x+surface.x-surface.width/2).toBeGreaterThanOrEqual(hole.minX)
    expect(s.start.x+surface.x+surface.width/2).toBeLessThanOrEqual(hole.maxX+.00001)
    expect(s.start.z+surface.z-surface.depth/2).toBeGreaterThanOrEqual(hole.minZ)
    expect(s.start.z+surface.z+surface.depth/2).toBeLessThanOrEqual(hole.maxZ+.00001)
  }
  expect(uStairHeadroom(h,s)).toBeGreaterThan(2)
  for(const ref of ['wall/architekt/ground/12','wall/architekt/ground/13','wall/architekt/ground/14','wall/architekt/ground/15']){
    const wall=h.walls.find(w=>w.ref===ref)!
    expect(wall.heightM).toBeLessThan(.02);expect(wall.openings).toEqual([])
  }
  expect(h.walls.find(w=>w.ref==='wall/architekt/correction/0/kitchen-pantry/5')!.heightM).toBe(2.92)
  expect(h.walls.find(w=>w.ref==='wall/architekt/upper/16')).toEqual(parseProject(previousDirection).buildings[0].walls.find(w=>w.ref==='wall/architekt/upper/16'))
  expect(h.roof).toEqual(before.roof);expect(h.storeys).toEqual(before.storeys);expect(h.slabs).toEqual(before.slabs)
})

it('fits ceiling-height black cabinetry, a clear pantry approach and one island hob',()=>{
  const h=parseProject(data).buildings[0], items=h.furniture!, ceiling=h.storeys[0].clearHeightM
  const tall=items.filter(f=>f.cabinetry==='tall'||f.cabinetry==='oven-tower')
  expect(tall).toHaveLength(5)
  for(const item of tall){expect((item.elevationM??0)+item.heightM).toBeCloseTo(ceiling);expect(item.color).toBe('#202427')}
  const island=items.find(f=>f.catalogId==='kitchen-island')!, b=polygonBounds(interiorCorners(island))
  expect(b.maxX-b.minX).toBeCloseTo(.9);expect(b.maxZ-b.minZ).toBeCloseTo(2.45)
  const cabinet=items.find(f=>f.ref==='interior/reference-cabinet-one')!, c=polygonBounds(interiorCorners(cabinet))
  expect(b.minX-c.maxX).toBeGreaterThan(1)
  expect(items.filter(f=>f.cabinetry==='hob')).toHaveLength(1)
  const sink=items.find(f=>f.ref==='interior/reference-sink')!, hob=items.find(f=>f.cabinetry==='hob')!
  expect(sink.cabinetry).toBe('sink-insert');expect(sink.elevationM).toBe(island.heightM)
  expect(items.filter(f=>f.catalogId==='sink')).toHaveLength(1)
  for(const fixture of [sink,hob]){
    const bounds=polygonBounds(interiorCorners(fixture))
    expect(bounds.minX).toBeGreaterThan(b.minX);expect(bounds.maxX).toBeLessThan(b.maxX)
    expect(bounds.minZ).toBeGreaterThan(b.minZ);expect(bounds.maxZ).toBeLessThan(b.maxZ)
  }
  expect(polygonBounds(interiorCorners(sink)).minZ-polygonBounds(interiorCorners(hob)).maxZ).toBeCloseTo(.52)
  const formerNiche=items.find(f=>f.ref==='interior/architekt-711/kitchen-upper')!
  expect(formerNiche.heightM).toBe(2.92);expect(formerNiche.elevationM??0).toBe(0)
  const door=h.walls.flatMap(w=>w.openings).find(o=>o.ref==='opening/architekt-711/pantry')!
  expect(door.widthM).toBe(.799)
  expect(door.heightM).toBe(2.18)
  expect(door.concealed).toEqual({faceOffsetM:-.65,startFillerM:.0405,endFillerM:.0205})
  const pantryWall=h.walls.find(w=>w.openings.some(o=>o.ref===door.ref))!
  expect(pantryWall.start.x-door.concealed!.faceOffsetM+.01).toBeCloseTo(c.maxX)
  for(const item of tall.filter(f=>(f.elevationM??0)===0)){
    const bounds=polygonBounds(interiorCorners(item))
    expect(bounds.maxZ<=-3.715||bounds.minZ>=-2.915).toBe(true)
  }
})

it('fits the flush cabinet extension below the actual folded stair and leaves the lower flight open',()=>{
  const h=parseProject(data).buildings[0], old=parseProject(previousJoinery).buildings[0]
  const c=h.furniture!.find(f=>f.cabinetry==='under-stair')!, filler=h.furniture!.find(f=>f.ref.endsWith('/stair-junction-filler'))!, b=polygonBounds(interiorCorners(c))
  const bank=polygonBounds(interiorCorners(h.furniture!.find(f=>f.ref==='interior/reference-cabinet-one')!)), joint=polygonBounds(interiorCorners(filler))
  expect(b.maxX).toBeCloseTo(bank.maxX);expect(joint.maxX).toBeCloseTo(bank.maxX)
  expect(joint.minZ).toBeCloseTo(bank.maxZ);expect(joint.maxZ).toBeCloseTo(b.minZ)
  expect(b.maxZ-bank.maxZ).toBeCloseTo(1.2)
  expect(h.walls.filter(w=>w.ref!=='wall/architekt/ground/12')).toEqual(old.walls.filter(w=>w.ref!=='wall/architekt/ground/12'))
  const stairs=h.stairs![0], rise=h.storeys[1].elevationM-h.storeys[0].elevationM, upper=uStairSurfaces(stairs,rise).filter(s=>s.top>rise/2)
  expect(b.maxZ).toBeCloseTo(stairs.start.z+stairs.widthM-.02)
  const geometry=slopedCabinetGeometry(c.widthM,c.depthM,c.heightM,c.cabinetBackHeightM!,.09), material=new MeshBasicMaterial({side:DoubleSide}), mesh=new Mesh(geometry,material)
  mesh.rotation.y=c.rotationDegrees*Math.PI/180;mesh.position.set(c.position.x,0,c.position.z);mesh.updateMatrixWorld(true)
  for(let x=b.minX+.001;x<b.maxX;x+=.005){
    const surface=upper.find(s=>x>=stairs.start.x+s.x-s.width/2&&x<=stairs.start.x+s.x+s.width/2)!
    const left=stairs.start.x+surface.x-surface.width/2
    const soffit=x<left+.08 ? surface.top-rise/stairs.steps : surface.top-.08
    const hit=new Raycaster(new Vector3(x,4,c.position.z),new Vector3(0,-1,0)).intersectObject(mesh)[0]
    expect(hit).toBeDefined();expect(soffit-hit.point.y).toBeGreaterThan(.02)
  }
  geometry.dispose();material.dispose()
  const island=polygonBounds(interiorCorners(h.furniture!.find(f=>f.ref==='interior/reference-island')!))
  expect(island.minZ).toBeCloseTo(polygonBounds(interiorCorners(old.furniture!.find(f=>f.ref==='interior/reference-island')!)).minZ)
  const at240=upper.filter(s=>s.top-rise/stairs.steps<=2.4&&s.top>=2.4)
  expect(at240.length).toBeGreaterThan(0)
  for(const s of at240)expect(stairs.start.z+s.z-s.depth/2-island.maxZ).toBeCloseTo(.9)
})

it('migrates the wall removal and fitted extension from r4 while retaining independent saved deletions',async()=>{
  const before=parseProject(previousJoinery), local=structuredClone(before)
  local.landscape.plants.pop();local.buildings[0].furniture=local.buildings[0].furniture!.filter(f=>f.ref!=='interior/reference-coffee')
  const result=mergeProjects(before,local,parseProject(data));expect(result.conflicts).toEqual([])
  expect(result.project.landscape).toEqual(local.landscape)
  expect(result.project.buildings[0].furniture!.some(f=>f.ref==='interior/reference-coffee')).toBe(false)
  expect(result.project.buildings[0].furniture!.find(f=>f.cabinetry==='under-stair')?.cabinetBackHeightM).toBe(1.995)
  expect(result.project.buildings[0].walls.find(w=>w.ref==='wall/architekt/ground/12')?.heightM).toBe(.01)
  await saveWorkspace({version:1,project:result.project,proposals:[],draftChangeSets:[]})
  expect((await loadWorkspace(ARCHITEKT_711_REF))!.project).toEqual(result.project)
})

it('merges the reversed flights and relocated sink into r2 without losing unrelated edits or resurrecting a deletion',()=>{
  const before=parseProject(previousDirection), local=structuredClone(before)
  local.landscape.plants.pop();local.buildings[0].furniture=local.buildings[0].furniture!.filter(f=>f.ref!=='interior/reference-stool-two')
  const merged=mergeProjects(before,local,parseProject(data))
  expect(merged.conflicts).toEqual([])
  expect(merged.project.buildings[0].stairs![0].uTurn?.entrySide).toBe('max-z')
  expect(merged.project.buildings[0].furniture!.find(f=>f.ref==='interior/reference-sink')?.cabinetry).toBe('sink-insert')
  expect(merged.project.buildings[0].furniture!.some(f=>f.ref==='interior/reference-stool-two')).toBe(false)
  expect(merged.project.landscape).toEqual(local.landscape)
})

it('migrates saved r1 while preserving independent edits and deletions, and reports conflicting stair edits',async()=>{
  const old=parseProject(previousInterior), local=structuredClone(old)
  local.landscape.plants.pop();local.buildings[0].furniture=local.buildings[0].furniture!.filter(f=>f.catalogId!=='coffee-table')
  await saveWorkspace({version:1,project:local,proposals:[],draftChangeSets:[]})
  expect(await synchronizePublishedArchitekt711()).toEqual([])
  const saved=(await loadWorkspace(ARCHITEKT_711_REF))!
  expect(saved.project.landscape).toEqual(local.landscape)
  expect(saved.project.buildings[0].furniture!.some(f=>f.catalogId==='coffee-table')).toBe(false)
  expect(saved.project.buildings[0].stairs).toEqual(data.buildings[0].stairs)
  await synchronizePublishedArchitekt711();expect(await loadWorkspace(ARCHITEKT_711_REF)).toEqual(saved)
  local.buildings[0].stairs![0].runM=2.3
  expect(mergeProjects(old,local,parseProject(data)).conflicts.some(p=>p.endsWith('/runM'))).toBe(true)
})

it('copies only the house changes and preserves the full existing garden and other buildings',()=>{
  const p=parseProject(data), old=parseProject(source), h=p.buildings[0]
  expect(p.ref).toBe(ARCHITEKT_711_REF)
  expect(p.name).toBe('architekt 7.11')
  expect(p.landscape).toEqual(old.landscape);expect(p.site).toEqual(old.site)
  expect(p.buildings.slice(1)).toEqual(old.buildings.slice(1))
  expect(h.position).toEqual(old.buildings[0].position)
  expect(h.slabs[0]).toEqual(old.buildings[0].slabs[0])
  expect(validateProject(p).filter(i=>i.severity==='error')).toEqual([])
  expect(h.storeys[1].elevationM-h.storeys[0].elevationM).toBeCloseTo(3.25,8)
  expect(h.walls.flatMap(w=>w.openings).some(o=>o.ref==='opening/architekt/bath-window')).toBe(false)
  expect(h.spaces.find(s=>s.name==='Spiżarnia')).toBeDefined()
})

it('derives compliant symmetric slopes, a common ridge and connected shaped glazing',()=>{
  const h=parseProject(data).buildings[0], wings=roofWings(h)
  for(const w of wings){const b=polygonBounds(w.footprint),span=w.ridgeAxis==='z'?b.maxX-b.minX:b.maxZ-b.minZ
    const angle=Math.atan2(w.ridgeElevationM-w.baseElevationM,span/2)*180/Math.PI
    expect(angle).toBeGreaterThanOrEqual(37);expect(angle).toBeLessThanOrEqual(45)
    expect(w.ridgeElevationM).toBeCloseTo(8.35151107081196,8)
  }
  expect(gableRoofJunction(h,wings[1])?.side).toBe('min')
  expect(gableWallsForBuilding(h).some(g=>g.segmentRef===wings[1].ref&&g.side==='min')).toBe(false)
  for(const [index,side,count] of [[0,'min',1],[0,'max',2],[1,'max',2]] as const){
    const panels=gableGlazingProfile(h.roof.segments[index],side,h)!.panels
    expect(panels).toHaveLength(count);expect(panels.every(p=>p.connected)).toBe(true)
  }
})

it('cuts the bathroom roof light through both the roof panel and interior ceiling',()=>{
  const h=parseProject(data).buildings[0], s=h.roof.segments[0], w=s.windows![0], layout=roofWindowLayout(s,w)
  expect(layout.fits).toBe(true)
  const material=new MeshBasicMaterial({side:DoubleSide})
  const roof=clippedRoofBox([5,.2,15],[w.position.x,layout.elevationM,w.position.z],layout.rotation,[],roofWindowCutouts(s))
  const ceiling=ceilingGeometry(h,h.storeys[1],spaceFootprint(h,h.spaces.find(s=>s.ref==='space/reference-bathroom')!),4.28,false,2.7)
  for(const geometry of [roof,ceiling]){
    const mesh=new Mesh(geometry,material)
    const ray=(x:number,z:number)=>new Raycaster(new Vector3(x,-2,z),new Vector3(0,1,0)).intersectObject(mesh)
    expect(ray(w.position.x,w.position.z)).toHaveLength(0)
    expect(ray(w.position.x,w.position.z+.6).length).toBeGreaterThan(0)
    geometry.dispose()
  }
  material.dispose()
})

it('saves independently, survives reload and preserves deletion without changing the original',async()=>{
  const original={version:1 as const,project:parseProject(source),proposals:[],draftChangeSets:[]}
  original.project.landscape.plants.pop();await saveWorkspace(original)
  await synchronizePublishedArchitekt711()
  expect(await loadWorkspace(original.project.ref)).toEqual(original)
  const saved=(await loadWorkspace(ARCHITEKT_711_REF))!
  saved.project.landscape.plants.pop();saved.project.buildings[0].roof.segments[0].windows=[]
  await saveWorkspace(saved);await synchronizePublishedArchitekt711()
  expect((await loadWorkspace(ARCHITEKT_711_REF))!.project).toEqual(saved.project)
  await deleteWorkspace(ARCHITEKT_711_REF);await synchronizePublishedArchitekt711()
  expect(await loadWorkspace(ARCHITEKT_711_REF)).toBeNull()
  expect(await loadWorkspace(original.project.ref)).toEqual(original)
})
