import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import data from '../../project-data/nowe-mpzp-v2/project.json'
import beforeThuja from '../../project-data/nowe-mpzp-v2/before-thuja-r2.json'
import beforeTerrace from '../../project-data/nowe-mpzp-v2/before-terrace-canopy-r3.json'
import beforeAllPlants from '../../project-data/nowe-mpzp-v2/before-all-thuja-grass-r4.json'
import beforeGardenRefine from '../../project-data/nowe-mpzp-v2/before-garden-refine-r5.json'
import beforeCompact from '../../project-data/nowe-mpzp-v2/before-compact-kitchen-r6.json'
import parent from '../../project-data/nowe-mpzp/project.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { gardenFixtureById } from '../domain/gardenFixtures'
import { buildingFootprintsWorld, distanceToSegment, pointInPolygon, polygonArea } from '../domain/geometry'
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
  expect(p.landscape.fixtures.map(f=>f.catalogId)).toEqual(expect.arrayContaining(['round-hot-tub','garden-sauna','pizza-oven-tall-flue','compact-kitchen-spa','outdoor-kitchen-l','greenhouse']))
  const pergola=p.landscape.fixtures.find(f=>f.catalogId==='compact-kitchen-spa')!
  const kitchen=p.landscape.fixtures.find(f=>f.catalogId==='outdoor-kitchen-l')!
  const table=p.landscape.fixtures.find(f=>f.ref.endsWith('/summer-table'))!
  for(const f of [kitchen,table]){
    const size=gardenFixtureById(f.catalogId)
    expect(Math.abs(f.position.x-pergola.position.x)+size.depthM/2).toBeLessThan(3.2)
    expect(Math.abs(f.position.z-pergola.position.z)+size.widthM/2).toBeLessThan(4.9)
  }
  expect(kitchen.position.x+.85-.4-(table.position.x+1.25)).toBeGreaterThanOrEqual(1)
  const oven=p.landscape.fixtures.find(f=>f.catalogId==='pizza-oven-tall-flue')!
  expect(oven.position.z-.5-(kitchen.position.z+2.2)).toBeGreaterThanOrEqual(.199)
  expect(oven.rotationDegrees).toBe(-90)
  expect(oven.position.x+.15-pergola.position.x).toBeCloseTo(2.15)
  expect(oven.position.z-pergola.position.z).toBeCloseTo(.8)
  const deck=p.landscape.zones.find(z=>z.ref==='zone/terrace')!
  expect(resolveZoneTexture(deck)?.id).toBe('hinoki')
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
    if(a.kind==='hedge'&&b.kind==='hedge'&&/\/(west|east|rear)-border-/.test(a.ref)&&/\/(west|east|rear)-border-/.test(b.ref)) {
      expect(Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)).toBeGreaterThan(.79)
      continue
    }
    expect(Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)).toBeGreaterThan((a.canopyM+b.canopyM)/2)
  }
  const fruit=p.landscape.plants.filter(t=>t.ref.startsWith('plant/nowe-mpzp/fruit-'))
  expect(fruit).toHaveLength(7)
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
  const p=parseProject(beforeTerrace), before=parseProject(beforeThuja)
  const changed=(ref:string)=> /^plant\/nowe-mpzp-v2\/east-border-([1-9]|1\d|2[0-7])$/.test(ref)
  expect(p.buildings).toEqual(before.buildings)
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

it('swaps terrace sets, covers the kitchen-to-sauna route, and preserves plants and independent saved edits',()=>{
  const p=parseProject(beforeAllPlants),before=parseProject(beforeTerrace)
  const fixture=(project:typeof p,suffix:string)=>project.landscape.fixtures.find(f=>f.ref===`fixture/nowe-mpzp-v2/${suffix}`)!
  expect(p.landscape.plants).toEqual(before.landscape.plants)
  expect(fixture(p,'terrace-lounge').position).toEqual(fixture(before,'terrace-dining').position)
  expect(fixture(p,'terrace-lounge').rotationDegrees).toBe(180)
  expect(fixture(p,'terrace-dining').position).toEqual(fixture(before,'terrace-lounge').position)
  const canopy=fixture(p,'pergola'),size=gardenFixtureById(canopy.catalogId)
  expect(size).toMatchObject({widthM:7.4,depthM:15.2,heightM:3.1})
  const deck=p.landscape.zones.find(z=>z.ref.endsWith('/summer-deck'))!
  expect(resolveZoneTexture(deck)?.id).toBe('hinoki')
  for(const suffix of ['kitchen','summer-table','hot-tub','sauna']){
    const f=fixture(p,suffix),s=gardenFixtureById(f.catalogId),a=f.rotationDegrees*Math.PI/180
    for(const x of [-s.widthM/2,s.widthM/2])for(const z of [-s.depthM/2,s.depthM/2]){
      const q={x:f.position.x+x*Math.cos(a)+z*Math.sin(a),z:f.position.z-x*Math.sin(a)+z*Math.cos(a)}
      expect(Math.abs(q.x-canopy.position.x)).toBeLessThan(size.widthM/2)
      expect(Math.abs(q.z-canopy.position.z)).toBeLessThan(size.depthM/2)
    }
  }
  for(const x of [-size.widthM/2,size.widthM/2])for(const z of [-size.depthM/2,size.depthM/2])
    expect(pointInPolygon({x:canopy.position.x+x,z:canopy.position.z+z},deck.footprint)).toBe(true)
  const changed=new Set(['terrace-lounge','terrace-dining','pergola','pizza','sauna'].map(s=>`fixture/nowe-mpzp-v2/${s}`))
  expect(p.landscape.fixtures.filter(f=>!changed.has(f.ref))).toEqual(before.landscape.fixtures.filter(f=>!changed.has(f.ref)))
  const local=structuredClone(before)
  local.landscape.fixtures=local.landscape.fixtures.filter(f=>f.ref!==fixture(before,'terrace-dining').ref)
  fixture(local,'hot-tub').position.x-=.1
  const merged=mergeProjects(before,local,p)
  expect(merged.project.landscape.fixtures.some(f=>f.ref===fixture(before,'terrace-dining').ref)).toBe(false)
  expect(fixture(merged.project,'hot-tub').position.x).toBe(9.9)
  expect(merged.conflicts).toHaveLength(1)
  expect(merged.conflicts[0]).toContain('terrace-dining')
})

it('replaces all remaining flowers with thujas and tall grasses without moving plants or changing the terrace and canopy',()=>{
  const p=parseProject(beforeGardenRefine),before=parseProject(beforeAllPlants)
  const replaced=(t:typeof p.landscape.plants[number])=>t.ref.startsWith('plant/nowe-mpzp-v2/')&&/^(Hydrangea|Lavandula)/.test(t.species)
  const refs=new Set(before.landscape.plants.filter(replaced).map(t=>t.ref))
  expect(refs.size).toBe(83)
  expect(p.landscape.plants.filter(t=>/^(Hydrangea|Lavandula)/.test(t.species))).toEqual([])
  expect(p.landscape.plants.map(t=>({ref:t.ref,position:t.position}))).toEqual(before.landscape.plants.map(t=>({ref:t.ref,position:t.position})))
  expect(p.landscape.plants.filter(t=>!refs.has(t.ref))).toEqual(before.landscape.plants.filter(t=>!refs.has(t.ref)))
  expect(p.landscape.fixtures).toEqual(before.landscape.fixtures)
  expect(p.landscape.zones).toEqual(before.landscape.zones)
  expect(p.buildings).toEqual(before.buildings)
  const ornamental=p.landscape.plants.filter(t=>t.ref.startsWith('plant/nowe-mpzp-v2/'))
  expect(ornamental.filter(t=>t.species==="Thuja occidentalis 'Smaragd'")).toHaveLength(44)
  expect(ornamental.filter(t=>t.species==="Calamagrostis × acutiflora 'Karl Foerster'")).toHaveLength(117)
  for(const t of ornamental){
    expect(t.matureHeightM).toBe(t.kind==='hedge'?4.6:1.8)
    expect(t.canopyM).toBe(t.kind==='hedge'?1.3:.6)
  }
  for(const ref of ['terrace-front-4','terrace-front-7','vegetable-front-1','vegetable-front-4'])
    expect(p.landscape.plants.find(t=>t.ref===`plant/nowe-mpzp-v2/${ref}`)?.kind).toBe('grass')
  const local=structuredClone(before),deleted='plant/nowe-mpzp-v2/west-border-4'
  local.landscape.plants=local.landscape.plants.filter(t=>t.ref!==deleted)
  local.name='Mój ogród'
  const merged=mergeProjects(before,local,p)
  expect(merged.project.landscape.plants.some(t=>t.ref===deleted)).toBe(false)
  expect(merged.project.name).toBe('Mój ogród')
  expect(merged.conflicts).toHaveLength(1)
  expect(merged.conflicts[0]).toContain(deleted)
})

it('removes the marked trees, densifies only the existing fence rows and preserves saved deletions across migration',async()=>{
  const p=parseProject(beforeCompact),before=parseProject(beforeGardenRefine)
  const removed=before.landscape.plants.filter(t=>!p.landscape.plants.some(n=>n.ref===t.ref))
  expect(removed).toHaveLength(16)
  expect(removed.filter(t=>t.species.startsWith('Thuja '))).toHaveLength(11)
  expect(removed.every(t=>/\/(terrace-|spa-|vegetable-)/.test(t.ref)||/fruit-(08|09|10|11|12)$/.test(t.ref))).toBe(true)
  expect(p.landscape.plants.filter(t=>t.kind==='grass')).toHaveLength(117)
  const additions=p.landscape.plants.filter(t=>!before.landscape.plants.some(n=>n.ref===t.ref))
  expect(additions.length).toBeGreaterThan(100)
  expect(additions.every(t=>t.species.startsWith('Thuja ')&&t.ref.includes('-border-')&&t.canopyM===1.3&&t.matureHeightM===4.6)).toBe(true)
  for(const t of additions){
    expect(pointInPolygon(t.position,p.site.boundary)).toBe(true)
    expect(Math.min(...p.site.boundary.map((v,i)=>distanceToSegment(t.position,v,p.site.boundary[(i+1)%p.site.boundary.length])))-t.canopyM/2).toBeGreaterThan(.249)
    expect(p.landscape.plants.some(n=>n!==t&&n.kind==='hedge'&&Math.hypot(n.position.x-t.position.x,n.position.z-t.position.z)<=.951)).toBe(true)
  }
  expect(p.landscape.zones.some(z=>/fruit-mulch-(8|9|10|11|12)$/.test(z.ref))).toBe(false)
  expect(p.landscape.zones.filter(z=>z.kind==='lawn').every(z=>z.colorHex==='#B7D7A5')).toBe(true)
  const changed=new Set(['fixture/nowe-mpzp-v2/pergola','fixture/nowe-mpzp-v2/pizza'])
  expect(p.landscape.fixtures.filter(f=>!changed.has(f.ref))).toEqual(before.landscape.fixtures.filter(f=>!changed.has(f.ref)))
  globalThis.indexedDB=new IDBFactory()
  const local=structuredClone(before),deleted='plant/nowe-mpzp-v2/west-border-4'
  local.name='Mój ogród';local.landscape.plants=local.landscape.plants.filter(t=>t.ref!==deleted)
  const merged=mergeProjects(before,local,p)
  expect(merged.conflicts).toEqual([])
  await saveWorkspace({version:1,project:merged.project,proposals:[],draftChangeSets:[]})
  const reloaded=(await loadWorkspace(p.ref))!.project
  expect(reloaded.name).toBe('Mój ogród')
  expect(reloaded.landscape.plants.some(t=>t.ref===deleted||removed.some(r=>r.ref===t.ref))).toBe(false)
})

it('compacts only the kitchen and spa, preserves real sizes and migrates independent edits and deletions',async()=>{
  const p=parseProject(data),before=parseProject(beforeCompact)
  const bySuffix=(project:typeof p,suffix:string)=>project.landscape.fixtures.find(f=>f.ref===`fixture/nowe-mpzp-v2/${suffix}`)!
  const changed=['pergola','kitchen','pizza','summer-table','hot-tub','sauna'].map(s=>bySuffix(p,s).ref)
  expect(p.landscape.fixtures.filter(f=>!changed.includes(f.ref))).toEqual(before.landscape.fixtures.filter(f=>!changed.includes(f.ref)))
  expect(p.landscape.plants.filter(t=>!t.ref.includes('/spa-'))).toEqual(before.landscape.plants.filter(t=>!t.ref.includes('/spa-')))
  expect(p.landscape.plants.map(t=>({...t,position:null}))).toEqual(before.landscape.plants.map(t=>({...t,position:null})))
  const deck=p.landscape.zones.find(z=>z.ref.endsWith('/summer-deck'))!
  expect(polygonArea(deck.footprint)).toBeCloseTo(73.44)
  expect(polygonArea(deck.footprint)/polygonArea(before.landscape.zones.find(z=>z.ref===deck.ref)!.footprint)).toBeLessThan(.56)
  for(const suffix of ['hot-tub','sauna','summer-table'])expect(bySuffix(p,suffix).catalogId).toBe(bySuffix(before,suffix).catalogId)
  for(const suffix of changed.map(ref=>ref.split('/').at(-1)!)){
    const f=bySuffix(p,suffix),size=gardenFixtureById(f.catalogId),a=f.rotationDegrees*Math.PI/180
    for(const x of [-size.widthM/2,size.widthM/2])for(const z of [-size.depthM/2,size.depthM/2])expect(pointInPolygon({x:f.position.x+x*Math.cos(a)+z*Math.sin(a),z:f.position.z-x*Math.sin(a)+z*Math.cos(a)},deck.footprint),suffix).toBe(true)
  }
  expect(24.3-(bySuffix(p,'sauna').position.z+1.5)).toBeGreaterThanOrEqual(.9)
  const local=structuredClone(before),deleted=bySuffix(before,'summer-table').ref
  local.name='Własny ogród';local.landscape.fixtures=local.landscape.fixtures.filter(f=>f.ref!==deleted)
  const merged=mergeProjects(before,local,p)
  expect(merged.conflicts).toHaveLength(1)
  expect(merged.conflicts[0]).toContain(deleted)
  globalThis.indexedDB=new IDBFactory()
  await saveWorkspace({version:1,project:merged.project,proposals:[],draftChangeSets:[]})
  const reloaded=(await loadWorkspace(p.ref))!.project
  expect(reloaded.name).toBe('Własny ogród')
  expect(reloaded.landscape.fixtures.some(f=>f.ref===deleted)).toBe(false)
})
