import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import data from '../../project-data/zielonki-rear-bath-room/before-master-oak-r9.json'
import prior from '../../project-data/zielonki-rear-bath-room/before-ground-bathroom-b-r7.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { placementWarnings } from '../domain/interiorPlacement'
import { loadWorkspace,saveWorkspace,synchronizePublishedProject } from './persistence'
const p=parseProject(data),b=parseProject(prior),h=p.buildings[0]
it('fits bathroom B in MAIN while preserving its upstairs, roof and other buildings',()=>{
 expect(validateProject(p).filter(i=>i.severity==='error')).toEqual([])
 const upper=h.storeys.find(s=>s.ref==='storey/reference-upper')!
 const old=b.buildings[0]
 expect(h.walls.filter(w=>upper.wallRefs.includes(w.ref))).toEqual(old.walls.filter(w=>upper.wallRefs.includes(w.ref)))
 expect(h.furniture!.filter(i=>i.storeyRef===upper.ref)).toEqual(old.furniture!.filter(i=>i.storeyRef===upper.ref))
 expect(h.spaces.filter(s=>s.ref!=='space/reference-wc')).toEqual(old.spaces.filter(s=>s.ref!=='space/reference-wc'))
 expect(h.roof).toEqual(old.roof);expect(h.slabs).toEqual(old.slabs);expect(h.storeys).toEqual(old.storeys)
 expect(p.buildings.slice(1)).toEqual(b.buildings.slice(1));expect(p.landscape).toEqual(b.landscape)
 for(const ref of ['interior/carport-study/shower','interior/carport-study/vanity','interior/carport-study/wc','interior/ground-bathroom-b/linen','interior/carport-study/washer'])expect(placementWarnings(h.furniture!.find(i=>i.ref===ref)!,h,h.storeys[0]),ref).toEqual([])
})
it('migrates MAIN finishes with independent deletions intact across reload',async()=>{
 globalThis.indexedDB=new IDBFactory();await synchronizePublishedProject(b,b)
 const local=(await loadWorkspace(b.ref))!;local.project.landscape.plants.pop();await saveWorkspace(local)
 expect(await synchronizePublishedProject(p,b)).toEqual([])
 const saved=(await loadWorkspace(p.ref))!;expect(saved.project.name).toBe(p.name)
 expect(saved.project.landscape.plants).toHaveLength(local.project.landscape.plants.length)
 expect(saved.project.buildings[0].spaces.find(s=>s.ref==='space/reference-wc')!.floorFinish!.color).toBe('#CDBCA3')
 await saveWorkspace(saved);expect((await loadWorkspace(p.ref))!.project).toEqual(saved.project)
})
