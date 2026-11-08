import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import data from '../../project-data/architekt-7-11/project.json'
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

beforeEach(()=>{globalThis.indexedDB=new IDBFactory()})

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
