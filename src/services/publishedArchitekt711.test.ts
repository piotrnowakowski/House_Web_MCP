import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import data from '../../project-data/architekt-7-11/project.json'
import previousInterior from '../../project-data/architekt-7-11/before-interior-r1.json'
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

beforeEach(()=>{globalThis.indexedDB=new IDBFactory()})

it('opens the stair to the hall, leaves only the pantry attachment and fits the original floor aperture',()=>{
  const h=parseProject(data).buildings[0], before=parseProject(previousInterior).buildings[0], s=h.stairs![0]
  const rise=h.storeys[1].elevationM-h.storeys[0].elevationM
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
  for(const ref of ['wall/architekt/ground/13','wall/architekt/ground/14','wall/architekt/ground/15']){
    const wall=h.walls.find(w=>w.ref===ref)!
    expect(wall.heightM).toBeLessThan(.02);expect(wall.openings).toEqual([])
  }
  expect(h.walls.find(w=>w.ref==='wall/architekt/ground/12')!.heightM).toBe(2.92)
  expect(h.roof).toEqual(before.roof);expect(h.storeys).toEqual(before.storeys);expect(h.slabs).toEqual(before.slabs)
})

it('fits ceiling-height black cabinetry, a clear pantry approach and one island hob',()=>{
  const h=parseProject(data).buildings[0], items=h.furniture!, ceiling=h.storeys[0].clearHeightM
  const tall=items.filter(f=>f.cabinetry==='tall'||f.cabinetry==='oven-tower')
  expect(tall).toHaveLength(4)
  for(const item of tall){expect((item.elevationM??0)+item.heightM).toBeCloseTo(ceiling);expect(item.color).toBe('#202427')}
  const island=items.find(f=>f.catalogId==='kitchen-island')!, b=polygonBounds(interiorCorners(island))
  expect(b.maxX-b.minX).toBeCloseTo(.9);expect(b.maxZ-b.minZ).toBeCloseTo(2)
  const cabinet=items.find(f=>f.ref==='interior/reference-cabinet-one')!, c=polygonBounds(interiorCorners(cabinet))
  expect(b.minX-c.maxX).toBeGreaterThan(1)
  expect(items.filter(f=>f.cabinetry==='hob')).toHaveLength(1)
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
