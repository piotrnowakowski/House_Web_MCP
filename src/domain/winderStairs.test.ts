import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import current from '../../project-data/architekt-7-11/project.json'
import previous from '../../project-data/architekt-7-11/before-four-winders-r14.json'
import { parseProject } from './schema'
import { polygonArea } from './geometry'
import { winderGuardEdges, winderLayout, winderSurfaces } from './winderStairs'
import { applyStairVariant, currentStairVariant, stairCabinetRef } from './stairVariants'
import { uStairOpening } from './stairs'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from '../services/persistence'

it('limits the canonical update to stairs, their opening and owned joinery',()=>{
  const p=parseProject(current),old=parseProject(previous),b=p.buildings[0],before=old.buildings[0]
  expect(p.site).toEqual(old.site);expect(p.landscape).toEqual(old.landscape)
  expect(p.buildings.slice(1)).toEqual(old.buildings.slice(1))
  const owned=(ref:string)=>ref===stairCabinetRef||ref==='interior/architekt-711/stair-junction-filler'
  expect(b.furniture!.filter(f=>!owned(f.ref))).toEqual(before.furniture!.filter(f=>!owned(f.ref)))
  for(const key of ['walls','spaces','storeys','roof','position','rotationDegrees','platforms','ceilingFinishes'] as const)expect(b[key]).toEqual(before[key])
  expect(b.slabs[1].holes![1]).toEqual(before.slabs[1].holes![1])
})

it('has 19 equal rises, 10 + 4 + 4 treads, a 397 × 200 cm footprint and the approved upper exit',()=>{
  const b=parseProject(current).buildings[0],s=b.stairs![0],H=b.storeys[1].elevationM-b.storeys[0].elevationM
  const l=winderLayout(s,H)!,surfaces=winderSurfaces(s,H)
  expect(currentStairVariant(b)).toBe('winder-19-28')
  expect(surfaces.map(s=>s.step)).toEqual(Array.from({length:18},(_,i)=>i+1))
  expect(surfaces.filter(s=>s.kind==='turn')).toHaveLength(4)
  expect(l.lowerLength).toBeCloseTo(3.97);expect(l.upperLength+s.start.x).toBeCloseTo(-2.295)
  expect(l.riser*19).toBeCloseTo(3.25);expect(l.tread).toBeCloseTo(.28)
  expect(2*l.riser+l.tread).toBeCloseTo(.6221052632)
  expect(surfaces.every(p=>polygonArea(p.polygon)>0)).toBe(true)
  expect(surfaces.reduce((sum,p)=>sum+polygonArea(p.polygon),0)).toBeCloseTo(6.044073059,5)
  const headroom=2.92-l.riser*(1+(l.lowerLength-3.13)/l.tread)
  expect(headroom).toBeCloseTo(2.2357894737)
  expect(uStairOpening(b,s)).toHaveLength(6)
  const c=b.furniture!.find(f=>f.ref===stairCabinetRef)!
  expect(c.cabinetFrontHeightM).toBe(2.92);expect(c.heightM).toBe(2.4);expect(c.depthM).toBe(.6)
  const available=l.landingHeight+(l.upperLength-.6-s.uTurn!.landingDepthM)*l.riser/l.tread-.2/Math.cos(Math.atan(l.riser/l.tread))-.035
  expect(available-c.heightM).toBeGreaterThan(.04)
  const guards=winderGuardEdges(s,H)
  expect(guards.some(g=>Math.abs(g.a.x-l.lowerLength)<1e-8&&Math.abs(g.b.x-l.lowerLength)<1e-8)).toBe(false)
  expect(guards.some(g=>Math.abs(g.a.x-l.upperLength)<1e-8&&Math.abs(g.b.x-l.upperLength)<1e-8)).toBe(false)
})

it('matches the study when mirrored and does not leak winder geometry into landing presets',()=>{
  const b=parseProject(current).buildings[0],s=b.stairs![0]
  const a=winderSurfaces(s,3.25),mirrored=winderSurfaces({...s,uTurn:{...s.uTurn!,entrySide:'min-z'}},3.25)
  a.forEach((surface,i)=>surface.polygon.forEach((p,j)=>expect(p.z+mirrored[i].polygon[j].z).toBeCloseTo(2)))
  applyStairVariant(b,'open-12-6',true)
  expect(b.stairs![0].uTurn?.winders).toBeUndefined()
  applyStairVariant(b,'winder-19-28',true)
  expect(b.furniture!.find(f=>f.ref===stairCabinetRef)?.cabinetFrontHeightM).toBe(2.92)
})

it('migrates a saved r14 house, preserves unrelated deletions and stays stable after reload',async()=>{
  globalThis.indexedDB=new IDBFactory()
  const base=parseProject(previous),local=structuredClone(base)
  local.landscape.plants.pop();local.name='Mój zapis'
  await saveWorkspace({version:1,project:local,proposals:[],draftChangeSets:[]})
  expect(await synchronizePublishedProject(parseProject(current),base)).toEqual([])
  const saved=(await loadWorkspace(base.ref))!
  expect(currentStairVariant(saved.project.buildings[0])).toBe('winder-19-28')
  expect(saved.project.landscape).toEqual(local.landscape);expect(saved.project.name).toBe(local.name)
  expect(await synchronizePublishedProject(parseProject(current),base)).toEqual([])
  expect(await loadWorkspace(base.ref)).toEqual(saved)
})
