import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import data from '../../project-data/nowe-mpzp/project.json'
import before from '../../project-data/nowe-mpzp/before-garden-r13.json'
import beforeFireRow from '../../project-data/nowe-mpzp/before-fire-row-r15.json'
import { parseProject } from '../domain/schema'
import { gardenFixtureById } from '../domain/gardenFixtures'
import { pointInPolygon, distanceToSegment } from '../domain/geometry'
import { draftZoningLine } from '../../knowledge-bank/zielonki/draftPlan'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'
import { mergeProjects } from '../domain/projectMerge'

it('moves the fire court towards the house and closes the gaps in the same orchard without obstructing paths', () => {
  const p=parseProject(data), old=parseProject(beforeFireRow)
  const fruit=(ref:string)=>ref.startsWith('plant/nowe-mpzp/fruit-')
  const trees=p.landscape.plants.filter(t=>fruit(t.ref))
  expect(p.buildings).toEqual(old.buildings)
  const unchangedFixture=(ref:string)=>ref!=='fixture/nowe-mpzp/fire-lounge'&&!ref.startsWith('fixture-set/')
  expect(p.landscape.fixtures.filter(f=>unchangedFixture(f.ref))).toEqual(old.landscape.fixtures.filter(f=>unchangedFixture(f.ref)))
  const fire=p.landscape.fixtures.find(f=>f.catalogId==='round-fire-lounge')!, previousFire=old.landscape.fixtures.find(f=>f.ref===fire.ref)!
  expect({...fire,position:previousFire.position}).toEqual(previousFire)
  expect(fire.position.x).toBeCloseTo(previousFire.position.x-1)
  expect(fire.position.z).toBeCloseTo(previousFire.position.z+1.3)
  const unchangedPlant=(ref:string)=>!fruit(ref)&&![3,4,5].some(i=>ref.startsWith(`plant/nowe-mpzp/grasses-${i}-`))
  expect(p.landscape.plants.filter(t=>unchangedPlant(t.ref))).toEqual(old.landscape.plants.filter(t=>unchangedPlant(t.ref)))
  const unchangedZone=(ref:string)=>!ref.includes('/fruit-mulch-')&&!ref.includes('/lawn-')&&!ref.includes('/step-')&&!['/fire-court','/house-fire-path','/kitchen-garden','/grass-border-3','/grass-border-4','/grass-border-5'].some(s=>ref.endsWith(s))
  expect(p.landscape.zones.filter(z=>unchangedZone(z.ref))).toEqual(old.landscape.zones.filter(z=>unchangedZone(z.ref)))
  expect(trees.map(t=>t.position.z)).toEqual(Array.from({length:12},(_,i)=>-6+3*i))
  for(const tree of trees){
    const previous=old.landscape.plants.find(t=>t.ref===tree.ref)!
    expect({...tree,position:previous.position}).toEqual(previous)
    expect(tree.position.z).toBeLessThanOrEqual(previous.position.z)
    for(const zone of p.landscape.zones.filter(z=>['path','driveway','terrace'].includes(z.kind)||z.ref.endsWith('/fire-court'))){
      expect(pointInPolygon(tree.position,zone.footprint)).toBe(false)
      expect(Math.min(...zone.footprint.map((v,i)=>distanceToSegment(tree.position,v,zone.footprint[(i+1)%zone.footprint.length])))).toBeGreaterThan(tree.canopyM/2)
    }
  }
  const local=structuredClone(old)
  local.landscape.plants=local.landscape.plants.filter(t=>t.ref!==trees[2].ref)
  const merged=mergeProjects(old,local,p)
  expect(merged.conflicts.length).toBeGreaterThan(0)
  expect(merged.project.landscape.plants.some(t=>t.ref===trees[2].ref)).toBe(false)
})

it('moves the existing beds to the blue garden, keeps trees and buildings, and reserves twelve spaced fruit trees', () => {
  const p=parseProject(data)
  expect(p.buildings).toEqual(before.buildings)
  expect(p.site.parcels).toEqual(before.site.parcels)
  expect(p.site.entrances[0].start).toEqual(before.site.entrances[0].start)
  expect(p.site.entrances[0].end).toEqual(before.site.entrances[0].end)
  for(const tree of before.landscape.plants)expect(p.landscape.plants.find(t=>t.ref===tree.ref)).toEqual(tree)
  const beds=p.landscape.fixtures.filter(f=>f.catalogId==='raised-bed-2x1')
  expect(beds).toHaveLength(6)
  for(const old of before.landscape.fixtures.filter(f=>f.ref.startsWith('fixture-set/'))){
    const moved=p.landscape.fixtures.find(f=>f.ref===old.ref)!
    expect({...moved,position:old.position}).toEqual(old)
    expect(moved.position.z).toBeGreaterThanOrEqual(18.3)
  }
  const trees=p.landscape.plants.filter(t=>t.ref.startsWith('plant/nowe-mpzp/fruit-'))
  expect(trees).toHaveLength(12)
  for(const [i,tree] of trees.entries()){
    expect(Math.min(...p.site.boundary.map((v,j)=>distanceToSegment(tree.position,v,p.site.boundary[(j+1)%p.site.boundary.length])))).toBeGreaterThan(2.4)
    if(i){
      const spacing=Math.hypot(tree.position.x-trees[i-1].position.x,tree.position.z-trees[i-1].position.z)
      expect(spacing).toBeGreaterThanOrEqual(3)
      expect(spacing).toBeLessThan(3.01)
    }
  }
  for(const f of p.landscape.fixtures.filter(f=>['greenhouse','raised-bed-2x1'].includes(f.catalogId))){
    const {widthM:w,depthM:d}=gardenFixtureById(f.catalogId)
    for(const x of [-w/2,w/2])for(const z of [-d/2,d/2])expect(pointInPolygon({x:f.position.x+x,z:f.position.z+z},p.site.boundary)).toBe(true)
  }
  const greenhouse=p.landscape.fixtures.find(f=>f.catalogId==='greenhouse')!
  expect(greenhouse.position.z).toBeGreaterThan(draftZoningLine.intercept+draftZoningLine.slope*greenhouse.position.x)
  expect(greenhouse.name).toContain('lokalizacja warunkowa')
  expect(p.site.knowledgeBase.caveats.some(c=>c.includes('§37')&&c.includes('szklarnia'))).toBe(true)
  expect(p.landscape.zones.filter(z=>z.kind==='driveway')).toEqual(before.landscape.zones.filter(z=>z.kind==='driveway'))
  const fire=p.landscape.fixtures.find(f=>f.catalogId==='round-fire-lounge')!
  expect(fire.position).toEqual({x:11.8,z:4.4})
  const paths=p.landscape.zones.filter(z=>['path','terrace','driveway'].includes(z.kind))
  for(const grass of p.landscape.plants.filter(t=>t.kind==='grass'))for(const path of paths){
    expect(pointInPolygon(grass.position,path.footprint)).toBe(false)
    expect(Math.min(...path.footprint.map((v,i)=>distanceToSegment(grass.position,v,path.footprint[(i+1)%path.footprint.length])))).toBeGreaterThanOrEqual(grass.canopyM/2)
  }
  expect(beds[1].position.z-beds[0].position.z-1.2).toBeCloseTo(.8)
  expect(beds[3].position.x-beds[0].position.x-2.4).toBeCloseTo(1)
  expect(beds[0].position.z-.6-greenhouse.position.z-gardenFixtureById('greenhouse').depthM/2).toBeCloseTo(1)
})

it('migrates the garden without restoring a deleted old bed and retains deletion of the new greenhouse after reload',async()=>{
  globalThis.indexedDB=new IDBFactory()
  await synchronizePublishedProject(parseProject(before),parseProject(before))
  const workspace=(await loadWorkspace(data.ref))!
  workspace.project.landscape.fixtures=workspace.project.landscape.fixtures.filter(f=>!f.ref.endsWith('-tomato'))
  await saveWorkspace(workspace)
  const conflicts=await synchronizePublishedProject(parseProject(data),parseProject(before))
  // A moved-versus-deleted bed is a conflict, never silently resurrected.
  expect(conflicts.length).toBeGreaterThan(0)
  expect((await loadWorkspace(data.ref))!.project.landscape.fixtures.some(f=>f.ref==='fixture-set/starter-1/bed-tomato')).toBe(false)
  globalThis.indexedDB=new IDBFactory()
  await synchronizePublishedProject(parseProject(data),parseProject(before))
  const current=(await loadWorkspace(data.ref))!
  current.project.landscape.fixtures=current.project.landscape.fixtures.filter(f=>f.catalogId!=='greenhouse')
  await saveWorkspace(current);await synchronizePublishedProject(parseProject(data),parseProject(before))
  expect((await loadWorkspace(data.ref))!.project.landscape.fixtures.some(f=>f.catalogId==='greenhouse')).toBe(false)
})
