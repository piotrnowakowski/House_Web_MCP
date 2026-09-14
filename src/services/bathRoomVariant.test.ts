import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import data from '../../project-data/zielonki-rear-bath-room/project.json'
import source from '../../project-data/zielonki-rear-carport/project.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { roomDimensions } from '../domain/roomDimensions'
import { interiorCorners } from '../domain/interior'
import { pointInPolygon, pointOnPolygonBoundary } from '../domain/geometry'
import { placementWarnings } from '../domain/interiorPlacement'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'
import { synchronizePublishedBathRoom } from './publishedBathRoom'
const p=parseProject(data), h=p.buildings[0], old=parseProject(source).buildings[0]
const space=(id:string)=>h.spaces.find(s=>s.ref===`space/reference-${id}`)!
const dims=(id:string)=>roomDimensions(h,space(id))
it('extends the bathroom one metre into bedroom 1 with separate hall doors and contained furniture',()=>{
 expect(validateProject(p).filter(i=>i.severity==='error')).toEqual([])
 const oldBath=roomDimensions(old,old.spaces.find(s=>s.ref==='space/reference-bathroom')!)
 expect(dims('bathroom').bounds.maxZ-oldBath.bounds.maxZ).toBeCloseTo(1)
 expect(dims('bathroom').area).toBeGreaterThan(oldBath.area)
 for(const id of ['bathroom','child-one','child-two']) {
  const w=h.walls.find(w=>w.openings.some(o=>o.ref===`opening/reference-${id}`))!
  expect(space(id).boundary.some(b=>b.wallRef===w.ref)).toBe(true)
  expect(space('landing').boundary.some(b=>b.wallRef===w.ref)).toBe(true)
 }
 for(const f of h.furniture!) {
  const id=f.ref.startsWith('interior/shared-upper-bath/')?'bathroom':f.ref.startsWith('interior/child-1/')?'child-one':f.ref.startsWith('interior/child-2/')?'child-two':null
  if(!id)continue
  expect(interiorCorners(f).every(c=>pointInPolygon(c,dims(id).footprint)||pointOnPolygonBoundary(c,dims(id).footprint)),f.ref).toBe(true)
  expect(placementWarnings(f,h,h.storeys[1]).filter(w=>w.kind!=='circulation'),f.ref).toEqual([])
 }
 console.log(Object.fromEntries(['bathroom','child-one','child-two'].map(id=>[id,dims(id).area])))
})
it('keeps the source study and exterior, stairs, parents and wardrobe intact',()=>{
 expect(p.ref).not.toBe(source.ref)
 for(const k of ['roof','stairs','slabs','position','rotationDegrees'] as const)expect(h[k]).toEqual(old[k])
 expect(h.walls.filter(w=>old.storeys[0].wallRefs.includes(w.ref))).toEqual(old.walls.filter(w=>old.storeys[0].wallRefs.includes(w.ref)))
 for(const id of ['parents','wardrobe'])expect(dims(id)).toEqual(roomDimensions(old,old.spaces.find(s=>s.ref===`space/reference-${id}`)!))
 expect(p.site).toEqual(source.site);expect(p.landscape).toEqual(source.landscape)
})
it('loads an independent alternative and preserves edits and deletion across reload',async()=>{
 globalThis.indexedDB=new IDBFactory()
 const original=parseProject(source);await synchronizePublishedProject(original,original)
 const before=await loadWorkspace(original.ref)
 await synchronizePublishedBathRoom()
 const saved=(await loadWorkspace(p.ref))!;saved.project.name='My bathroom alternative'
 saved.project.buildings[0].furniture=saved.project.buildings[0].furniture!.filter(f=>f.ref!=='interior/child-1/desk')
 await saveWorkspace(saved);await synchronizePublishedBathRoom()
 expect((await loadWorkspace(p.ref))!.project).toEqual(saved.project)
 expect(await loadWorkspace(original.ref)).toEqual(before)
})
