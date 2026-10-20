import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import data from '../../project-data/nowe-mpzp/project.json'
import before from '../../project-data/nowe-mpzp/before-garden-r13.json'
import { parseProject } from '../domain/schema'
import { gardenFixtureById } from '../domain/gardenFixtures'
import { pointInPolygon, distanceToSegment } from '../domain/geometry'
import { draftZoningLine } from '../../knowledge-bank/zielonki/draftPlan'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

it('moves the existing beds to the blue garden, keeps trees and buildings, and reserves twelve spaced fruit trees', () => {
  const p=parseProject(data)
  expect(p.buildings).toEqual(before.buildings)
  expect(p.site.parcels).toEqual(before.site.parcels)
  expect(p.site.entrances).toEqual(before.site.entrances)
  for(const tree of before.landscape.plants)expect(p.landscape.plants.find(t=>t.ref===tree.ref)).toEqual(tree)
  const beds=p.landscape.fixtures.filter(f=>f.catalogId==='raised-bed-2x1')
  expect(beds).toHaveLength(6)
  for(const old of before.landscape.fixtures.filter(f=>f.ref.startsWith('fixture-set/'))){
    const moved=p.landscape.fixtures.find(f=>f.ref===old.ref)!
    expect({...moved,position:old.position}).toEqual(old)
    expect(moved.position.z).toBeGreaterThan(19)
  }
  const trees=p.landscape.plants.filter(t=>t.ref.startsWith('plant/nowe-mpzp/fruit-'))
  expect(trees).toHaveLength(12)
  for(const [i,tree] of trees.entries()){
    expect(Math.min(...p.site.boundary.map((v,j)=>distanceToSegment(tree.position,v,p.site.boundary[(j+1)%p.site.boundary.length])))).toBeGreaterThan(2.4)
    if(i)expect(Math.hypot(tree.position.x-trees[i-1].position.x,tree.position.z-trees[i-1].position.z)).toBeGreaterThanOrEqual(4)
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
  expect(fire.position).toEqual({x:12.8,z:3.1})
  const paths=p.landscape.zones.filter(z=>['path','terrace','driveway'].includes(z.kind))
  for(const grass of p.landscape.plants.filter(t=>t.kind==='grass'))for(const path of paths){
    expect(pointInPolygon(grass.position,path.footprint)).toBe(false)
    expect(Math.min(...path.footprint.map((v,i)=>distanceToSegment(grass.position,v,path.footprint[(i+1)%path.footprint.length])))).toBeGreaterThanOrEqual(grass.canopyM/2)
  }
  expect(beds[1].position.z-beds[0].position.z-1.2).toBeCloseTo(1.4)
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
