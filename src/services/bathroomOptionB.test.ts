import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect,it } from 'vitest'
import data from '../../project-data/zielonki-rear-carport/project.json'
import base from '../../project-data/zielonki-rear-carport/before-bathroom-option-b-r142.json'
import { parseProject } from '../domain/schema'
import {validateProject} from '../domain/commands'
import {placementWarnings} from '../domain/interiorPlacement'
import { saveWorkspace,loadWorkspace,synchronizePublishedProject } from './persistence'
const p=parseProject(data),b=parseProject(base),h=p.buildings[0]
it('fits option B fixtures and changes finishes only on bathroom faces',()=>{
 for(const ref of ['interior/carport-study/shower','interior/carport-study/vanity','interior/carport-study/wc','interior/ground-bathroom-b/linen']) {
  const item=h.furniture!.find(i=>i.ref===ref)!;expect(placementWarnings(item,h,h.storeys[0]),ref).toEqual([])
 }
 expect(validateProject(p).filter(i=>i.severity==='error')).toEqual([])
 expect(h.roof).toEqual(b.buildings[0].roof);expect(h.slabs).toEqual(b.buildings[0].slabs);expect(h.storeys).toEqual(b.buildings[0].storeys)
 expect(p.landscape).toEqual(b.landscape)
 for(const wall of h.walls){const old=b.buildings[0].walls.find(w=>w.ref===wall.ref)!;const geometry=(w:typeof wall)=>({...w,faceFinishes:undefined,openings:w.openings.map(({finish,...opening})=>opening)});expect(geometry(wall)).toEqual(geometry(old))}
 expect(h.spaces.find(s=>s.ref==='space/reference-wc')!.floorFinish!.color).toBe('#CDBCA3')
 expect(h.spaces.filter(s=>s.ref!=='space/reference-wc'&&s.ref!=='space/reference-parents')).toEqual(b.buildings[0].spaces.filter(s=>s.ref!=='space/reference-wc'&&s.ref!=='space/reference-parents'))
})
it('saves and migrates tiles and fixtures without restoring independently deleted items',async()=>{
 globalThis.indexedDB=new IDBFactory();await synchronizePublishedProject(b,b)
 const w=(await loadWorkspace(b.ref))!;w.project.landscape.plants.pop();await saveWorkspace(w)
 expect(await synchronizePublishedProject(p,b)).toEqual([])
 const result=(await loadWorkspace(p.ref))!;expect(result.project.buildings[0].spaces.find(s=>s.ref==='space/reference-wc')!.floorFinish).toEqual(h.spaces.find(s=>s.ref==='space/reference-wc')!.floorFinish)
 expect(result.project.landscape.plants.length).toBe(w.project.landscape.plants.length)
 await saveWorkspace(result);expect((await loadWorkspace(p.ref))!.project).toEqual(result.project)
})
