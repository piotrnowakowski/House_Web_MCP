import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect,it } from 'vitest'
import data from '../../project-data/zielonki-rear-carport/project.json'
import previous from '../../project-data/zielonki-rear-carport/before-master-oak-r147.json'
import {parseProject} from '../domain/schema'
import {validateProject} from '../domain/commands'
import {interiorCorners} from '../domain/interior'
import {placementWarnings} from '../domain/interiorPlacement'
import {saveWorkspace,loadWorkspace,synchronizePublishedProject} from './persistence'
const p=parseProject(data),base=parseProject(previous),h=p.buildings[0]
it('keeps bedroom furniture clear of walls and doors and preserves building geometry',()=>{
 expect(validateProject(p).filter(i=>i.severity==='error')).toEqual([])
 expect(h.roof).toEqual(base.buildings[0].roof)
 expect(h.slabs).toEqual(base.buildings[0].slabs)
 expect(h.storeys).toEqual(base.buildings[0].storeys)
 expect(p.landscape).toEqual(base.landscape)
 expect(h.spaces.find(s=>s.ref==='space/reference-wardrobe')).toEqual(base.buildings[0].spaces.find(s=>s.ref==='space/reference-wardrobe'))
 const bedroom=h.furniture!.filter(f=>f.ref.startsWith('interior/master-oak/')||f.ref==='interior/reference-parents-bed')
 expect(bedroom).toHaveLength(8)
 for(const item of bedroom){
  expect(interiorCorners(item).every(c=>c.x>=-4.895&&c.x<=-.935&&c.z>=-6.455&&c.z<=-2.655),item.ref).toBe(true)
  expect(placementWarnings(item,h,h.storeys.find(s=>s.ref==='storey/reference-upper')!).filter(w=>w.kind!=='circulation'),item.ref).toEqual([])
 }
 expect(h.walls.flatMap(w=>w.openings).find(o=>o.ref==='opening/reference-parents')!.finish!.presetId).toBe('natural-oak')
})
it('migrates furnishings and door materials while preserving independent deletions across reload',async()=>{
 globalThis.indexedDB=new IDBFactory();await synchronizePublishedProject(base,base)
 const w=(await loadWorkspace(base.ref))!;w.project.landscape.plants.pop();await saveWorkspace(w)
 expect(await synchronizePublishedProject(p,base)).toEqual([])
 const saved=(await loadWorkspace(p.ref))!;expect(saved.project.landscape.plants).toEqual(w.project.landscape.plants)
 expect(saved.project.buildings[0].furniture).toEqual(h.furniture)
 expect(saved.project.buildings[0].walls).toEqual(h.walls)
 await saveWorkspace(saved);expect((await loadWorkspace(p.ref))!.project).toEqual(saved.project)
})
