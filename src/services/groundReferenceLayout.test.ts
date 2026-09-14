import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { it, expect } from 'vitest'
import data from '../../project-data/zielonki-rear-carport/project.json'
import previous from '../../project-data/zielonki-rear-carport/before-ground-reference-r131.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { polygonBounds, spaceFootprint } from '../domain/geometry'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'
const p=parseProject(data), before=parseProject(previous), h=p.buildings[0]
it('matches the supplied ground plan while preserving upper floor, envelope, stairs and roof',()=>{
  for(const [ref,width,depth] of [['space/reference-wc',3.665,2.06],['space/reference-pantry',3.665,1.81],['space/reference-office',3.015,4.07]] as const){
    const b=polygonBounds(spaceFootprint(h,h.spaces.find(s=>s.ref===ref)!))
    expect(b.maxX-b.minX-.2).toBeCloseTo(width,5);expect(b.maxZ-b.minZ-.2).toBeCloseTo(depth,5)
  }
  expect(h.walls.filter(w=>h.storeys[1].wallRefs.includes(w.ref))).toEqual(before.buildings[0].walls.filter(w=>h.storeys[1].wallRefs.includes(w.ref)))
  expect(h.roof).toEqual(before.buildings[0].roof);expect(h.slabs).toEqual(before.buildings[0].slabs)
  expect(h.storeys).toEqual(before.buildings[0].storeys);expect(p.landscape).toEqual(before.landscape)
  expect(p.buildings.slice(1)).toEqual(before.buildings.slice(1))
  expect(validateProject(p).filter(i=>i.severity==='error')).toEqual(validateProject(before).filter(i=>i.severity==='error'))
})
it('migrates a saved project and preserves independent deletion after reload',async()=>{
  globalThis.indexedDB=new IDBFactory();await synchronizePublishedProject(before,before)
  const w=(await loadWorkspace(p.ref))!;w.project.landscape.plants.pop();await saveWorkspace(w)
  expect(await synchronizePublishedProject(p,before)).toEqual([])
  const after=(await loadWorkspace(p.ref))!;expect(after.project.landscape.plants).toHaveLength(w.project.landscape.plants.length)
  expect(after.project.buildings[0].walls.find(w=>w.ref==='wall/carport-layout/ground/10')!.start.z).toBe(3.875)
  await saveWorkspace(after);expect((await loadWorkspace(p.ref))!.project).toEqual(after.project)
})
