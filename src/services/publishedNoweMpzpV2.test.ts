import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import data from '../../project-data/nowe-mpzp-v2/project.json'
import beforeThuja from '../../project-data/nowe-mpzp-v2/before-thuja-r2.json'
import parent from '../../project-data/nowe-mpzp/project.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { gardenFixtureById } from '../domain/gardenFixtures'
import { buildingFootprintsWorld, distanceToSegment, pointInPolygon } from '../domain/geometry'
import { resolveZoneTexture } from '../domain/textures'
import { mergeProjects } from '../domain/projectMerge'
import { loadWorkspace, saveWorkspace, deleteWorkspace, listWorkspaces } from './persistence'
import { NOWE_MPZP_V2_REF, synchronizePublishedNoweMpzpV2 } from './publishedNoweMpzpV2'

it('keeps the house, roofs, site and surveyed trees while fitting the reference garden at metre scale', () => {
  const p=parseProject(data), source=parseProject(parent)
  expect(p.ref).toBe(NOWE_MPZP_V2_REF)
  expect(p.buildings).toEqual(source.buildings)
  expect(p.site.boundary).toEqual(source.site.boundary)
  expect(p.site.parcels).toEqual(source.site.parcels)
  expect(p.site.fences).toEqual(source.site.fences)
  expect(p.site.entrances).toEqual(source.site.entrances)
  expect(p.landscape.plants.filter(t=>t.surveyHandle)).toEqual(source.landscape.plants.filter(t=>t.surveyHandle))
  expect(validateProject(p).filter(i=>i.severity==='error')).toEqual([])
  const bodies=p.buildings.flatMap(buildingFootprintsWorld)
  for(const f of p.landscape.fixtures){
    const {widthM:w,depthM:d}=gardenFixtureById(f.catalogId),a=f.rotationDegrees*Math.PI/180
    for(const x of [-w/2,w/2])for(const z of [-d/2,d/2]){
      const q={x:f.position.x+x*Math.cos(a)+z*Math.sin(a),z:f.position.z-x*Math.sin(a)+z*Math.cos(a)}
      expect(pointInPolygon(q,p.site.boundary),f.ref).toBe(true)
      expect(bodies.some(poly=>pointInPolygon(q,poly)),f.ref).toBe(false)
    }
  }
  expect(p.landscape.fixtures.filter(f=>f.catalogId==='raised-bed-2x1')).toHaveLength(6)
  expect(p.landscape.fixtures.map(f=>f.catalogId)).toEqual(expect.arrayContaining(['round-hot-tub','garden-sauna','pizza-oven','kitchen-pergola','outdoor-kitchen','greenhouse']))
  const pergola=p.landscape.fixtures.find(f=>f.catalogId==='kitchen-pergola')!
  const kitchen=p.landscape.fixtures.find(f=>f.catalogId==='outdoor-kitchen')!
  const table=p.landscape.fixtures.find(f=>f.ref.endsWith('/summer-table'))!
  for(const f of [kitchen,table]){
    const size=gardenFixtureById(f.catalogId)
    expect(Math.abs(f.position.x-pergola.position.x)+size.depthM/2).toBeLessThan(2.5)
    expect(Math.abs(f.position.z-pergola.position.z)+size.widthM/2).toBeLessThan(3.5)
  }
  expect(kitchen.position.x-.4-(table.position.x+1.25)).toBeGreaterThanOrEqual(1)
  const oven=p.landscape.fixtures.find(f=>f.catalogId==='pizza-oven')!
  expect(oven.position.z+.5).toBeLessThan(pergola.position.z-3.5)
  const deck=p.landscape.zones.find(z=>z.ref==='zone/terrace')!
  expect(resolveZoneTexture(deck)?.id).toBe('coated-pine')
  expect(p.site.knowledgeBase.caveats.some(c=>c.includes('sauna')&&c.includes('18.R3.1'))).toBe(true)
})

it('reserves actual mature crowns and clear walks instead of scaling plants down',()=>{
  const p=parseProject(data), paths=p.landscape.zones.filter(z=>['terrace','path','driveway'].includes(z.kind))
  const ornamental=p.landscape.plants.filter(t=>t.ref.startsWith('plant/nowe-mpzp-v2/'))
  expect(ornamental.length).toBeGreaterThan(100)
  for(const t of ornamental)for(const z of paths){
    expect(pointInPolygon(t.position,z.footprint),t.ref).toBe(false)
    const gap=Math.min(...z.footprint.map((v,i)=>distanceToSegment(t.position,v,z.footprint[(i+1)%z.footprint.length])))-t.canopyM/2
    expect(gap,t.ref+' '+z.ref).toBeGreaterThanOrEqual(.149)
  }
  for(let i=0;i<ornamental.length;i++)for(let j=i+1;j<ornamental.length;j++){
    const a=ornamental[i],b=ornamental[j]
    expect(Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)).toBeGreaterThan((a.canopyM+b.canopyM)/2)
  }
  const fruit=p.landscape.plants.filter(t=>t.ref.startsWith('plant/nowe-mpzp/fruit-'))
  expect(fruit).toHaveLength(12)
  expect(fruit.every(t=>t.canopyM===3.2&&t.matureHeightM===3.5)).toBe(true)
  for(let i=0;i<fruit.length;i++)for(let j=i+1;j<fruit.length;j++)
    expect(Math.hypot(fruit[i].position.x-fruit[j].position.x,fruit[i].position.z-fruit[j].position.z)).toBeGreaterThan(3.2)
})

it('adds a separate project, reloads edits and deletions, and never rewrites the parent or resurrects a deleted variant',async()=>{
  globalThis.indexedDB=new IDBFactory()
  const original={version:1 as const,project:parseProject(parent),proposals:[],draftChangeSets:[]}
  original.project.name='Mój pierwszy wariant'
  await saveWorkspace(original)
  expect(await synchronizePublishedNoweMpzpV2()).toEqual([])
  expect((await listWorkspaces()).some(w=>w.ref===NOWE_MPZP_V2_REF)).toBe(true)
  const w=(await loadWorkspace(NOWE_MPZP_V2_REF))!
  w.project.name='Mój ogród 2'
  w.project.landscape.fixtures=w.project.landscape.fixtures.filter(f=>f.catalogId!=='garden-sauna')
  w.project.landscape.plants.pop()
  await saveWorkspace(w)
  expect(await synchronizePublishedNoweMpzpV2()).toEqual([])
  expect(await loadWorkspace(NOWE_MPZP_V2_REF)).toEqual(w)
  expect(await loadWorkspace(parent.ref)).toEqual(original)
  await deleteWorkspace(NOWE_MPZP_V2_REF);await synchronizePublishedNoweMpzpV2()
  expect(await loadWorkspace(NOWE_MPZP_V2_REF)).toBeNull()
})

it('changes only the indicated east border into nine thujas and nine grass triplets, preserving saved deletions',()=>{
  const p=parseProject(data), before=parseProject(beforeThuja)
  const changed=(ref:string)=> /^plant\/nowe-mpzp-v2\/east-border-([1-9]|1\d|2[0-7])$/.test(ref)
  expect(p.buildings).toEqual(before.buildings)
  expect(p.landscape.fixtures).toEqual(before.landscape.fixtures)
  expect(p.landscape.zones).toEqual(before.landscape.zones)
  expect(p.site.boundary).toEqual(before.site.boundary)
  expect(p.landscape.plants.filter(t=>!changed(t.ref)&&!t.ref.includes('/east-grass-group-'))).toEqual(before.landscape.plants.filter(t=>!changed(t.ref)))
  const border=p.landscape.plants.filter(t=>changed(t.ref)||t.ref.includes('/east-grass-group-'))
  expect(border.filter(t=>t.species.startsWith('Thuja '))).toHaveLength(9)
  expect(border.filter(t=>t.kind==='grass')).toHaveLength(27)
  for(const t of border){
    expect(t.canopyM).toBe(t.kind==='hedge'?1.3:.6)
    expect(t.matureHeightM).toBe(t.kind==='hedge'?4.6:1.8)
    expect(pointInPolygon(t.position,p.site.boundary)).toBe(true)
    const gap=Math.min(...p.site.boundary.map((v,i)=>distanceToSegment(t.position,v,p.site.boundary[(i+1)%p.site.boundary.length])))-t.canopyM/2
    expect(gap,t.ref).toBeGreaterThan(.249)
  }
  const local=structuredClone(before),deleted='plant/nowe-mpzp-v2/east-border-22'
  local.name='Własny ogród';local.landscape.plants=local.landscape.plants.filter(t=>t.ref!==deleted)
  const merged=mergeProjects(before,local,p)
  expect(merged.project.name).toBe('Własny ogród')
  expect(merged.project.landscape.plants.some(t=>t.ref===deleted)).toBe(false)
  expect(merged.conflicts).toHaveLength(1)
  expect(merged.conflicts[0]).toContain(deleted)
})
